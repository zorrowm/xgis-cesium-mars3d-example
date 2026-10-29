import * as mars3d from 'mars3d'
import { basemaps } from './options'

export interface LayerEntry {
  id: string
  name: string
  show: boolean
  opacity?: number
  setShow: (show: boolean) => void
  flyTo?: () => void
}

// Map objects remain outside Vue reactivity. Each tool owns and cleans up its objects.
// Based on the reference project's basic/{measure,analysis,addmarker,plot,roamLine,map-split,map-compare}/map.ts.
export function createMapTools(map: mars3d.Map) {
  const drawings = new mars3d.layer.GraphicLayer({ name: '我的标记与标绘' })
  const sketches = new mars3d.layer.GraphicLayer({ name: '交互临时图层' })
  const measure = new mars3d.thing.Measure({ label: { color: '#fff', font_size: 18 } })
  const sightline = new mars3d.thing.Sightline()
  map.addLayer(drawings)
  map.addLayer(sketches)
  map.addThing(measure)
  map.addThing(sightline)
  let route: mars3d.graphic.FixedRoute | undefined
  let split: mars3d.control.MapSplit | undefined
  let splitLayers: mars3d.layer.BaseLayer[] = []
  let previousBasemap: typeof map.basemap
  let shadows: mars3d.thing.Shadows | undefined
  let terrainClip: mars3d.thing.TerrainClip | undefined
  let underground: mars3d.thing.Underground | undefined
  let slope: mars3d.thing.Slope | undefined
  let contour: mars3d.thing.ContourLine | undefined
  let limitHeight: mars3d.thing.LimitHeight | undefined
  const editedModels = new Set<mars3d.layer.TilesetLayer>()
  const compareMaps: mars3d.Map[] = []
  const compareElements: HTMLElement[] = []
  const cameraListeners: Array<() => void> = []
  const originalStyle = map.container.style.cssText
  const originalPercentage = map.camera.percentageChanged
  const originalDepthTest = map.scene.globe.depthTestAgainstTerrain
  const originalFxaa = map.scene.postProcessStages.fxaa.enabled
  let disposed = false
  let drawGeneration = 0
  let clockState: { currentTime: mars3d.Cesium.JulianDate; startTime: mars3d.Cesium.JulianDate; stopTime: mars3d.Cesium.JulianDate; multiplier: number; clockRange: mars3d.Cesium.ClockRange; shouldAnimate: boolean } | undefined

  function cancelDraw() {
    drawGeneration++
    drawings.stopDraw()
    sketches.stopDraw()
    measure.stopDraw()
  }

  async function draw(type: string, name = '', color = '#3388ff', temporary = false) {
    cancelDraw()
    const generation = drawGeneration
    const owner = temporary ? sketches : drawings
    const graphic = await owner.startDraw({
      type,
      style: {
        color, opacity: 0.6, pixelSize: 12, width: 3,
        outline: true, outlineColor: '#fff', outlineWidth: 2,
        ...(name ? { label: { text: name, font_size: 18, color: '#fff', pixelOffsetY: -20 } } : {}),
      },
      attr: { name: name || type },
    })
    if (disposed) return undefined
    if (generation !== drawGeneration) { owner.removeGraphic(graphic, true); return undefined }
    return graphic
  }

  function stopRoute() {
    if (route) {
      route.stop()
      sketches.removeGraphic(route, true)
      route = undefined
    }
    if (clockState) {
      Object.assign(map.clock, clockState)
      clockState = undefined
    }
  }

  async function startRoute(speed: number) {
    stopRoute()
    const line = await draw('polyline', '', '#ffff00', true)
    if (!line) return
    const positions = line.positionsShow
    sketches.removeGraphic(line, true)
    clockState = {
      currentTime: map.clock.currentTime.clone(), startTime: map.clock.startTime.clone(), stopTime: map.clock.stopTime.clone(),
      multiplier: map.clock.multiplier, clockRange: map.clock.clockRange, shouldAnimate: map.clock.shouldAnimate,
    }
    route = new mars3d.graphic.FixedRoute({
      name: '飞行路线',
      position: { type: 'time', list: positions, speed },
      point: { color: '#ffff00', pixelSize: 12 },
      path: { color: '#00ffff', width: 3 },
      camera: { type: 'gs', radius: 1500 },
    })
    sketches.addGraphic(route)
    route.start()
  }

  function stopCompare() {
    if (split) {
      map.removeControl(split, true)
      split = undefined
      splitLayers.forEach(layer => map.removeLayer(layer, true))
      splitLayers = []
      map.basemap = previousBasemap
    }
    cameraListeners.forEach(remove => remove())
    cameraListeners.length = 0
    compareMaps.forEach(other => other.destroy())
    compareMaps.length = 0
    compareElements.forEach(element => element.remove())
    compareElements.length = 0
    map.container.style.cssText = originalStyle
    map.camera.percentageChanged = originalPercentage
    map.viewer.resize()
  }

  function startSplit(leftId: string, rightId: string) {
    stopCompare()
    previousBasemap = map.basemap
    map.basemap = 0
    const create = (id: string) => {
      const options = basemaps.find(item => item.id === id)!
      // SDK's create declaration incorrectly requires a literal property named “其他”.
      const layer = mars3d.LayerUtil.create({ ...options, id: `${id}-split`, show: true } as unknown as Parameters<typeof mars3d.LayerUtil.create>[0])
      map.addLayer(layer)
      splitLayers.push(layer)
      return layer
    }
    split = new mars3d.control.MapSplit({ leftLayer: create(leftId), rightLayer: create(rightId) })
    map.addControl(split)
  }

  function startCompare(count: 2 | 4) {
    stopCompare()
    const height = count === 4 ? '50%' : '100%'
    Object.assign(map.container.style, { width: '50%', height, right: 'auto', bottom: 'auto' })
    for (let index = 1; index < count; index++) {
      const element = document.createElement('div')
      element.className = 'comparison-map'
      element.id = `comparison-map-${index}`
      element.setAttribute('aria-label', `对比地图 ${index + 1}`)
      Object.assign(element.style, { position: 'absolute', width: '50%', height, left: index % 2 ? '50%' : '0', top: index >= 2 ? '50%' : '0', border: '1px solid #526075' })
      map.container.parentElement!.appendChild(element)
      compareElements.push(element)
      const other = new mars3d.Map(element.id, {
        scene: { center: map.getCameraView() },
        basemaps: basemaps.map((base, i) => ({ ...base, show: i === index })),
        terrain: { url: 'https://data.mars3d.cn/terrain', show: map.hasTerrain },
        control: { baseLayerPicker: true, homeButton: false, sceneModePicker: false, infoBox: false },
      })
      compareMaps.push(other)
    }
    const allMaps = [map, ...compareMaps]
    // Listen to the map actually receiving pointer input; this avoids camera event feedback loops.
    let source = map
    allMaps.forEach(current => {
      current.camera.percentageChanged = 0.01
      const select = () => { source = current }
      const sync = () => {
        if (source !== current) return
        const view = current.getCameraView()
        allMaps.filter(other => other !== current).forEach(other => other.setCameraView(view, { duration: 0 }))
      }
      current.container.addEventListener('pointerdown', select)
      current.container.addEventListener('wheel', select)
      current.on(mars3d.EventType.cameraChanged, sync)
      cameraListeners.push(() => {
        current.container.removeEventListener('pointerdown', select)
        current.container.removeEventListener('wheel', select)
        current.off(mars3d.EventType.cameraChanged, sync)
      })
      current.viewer.resize()
    })
  }

  async function analyzeVisibility() {
    const line = await draw('polyline', '', '#ffff00', true)
    if (!line) return
    const positions = line.positionsShow
    if (positions.length >= 2) await sightline.addAsync(positions[0]!, positions[positions.length - 1]!, { offsetHeight: 1.5 })
    if (!disposed) sketches.removeGraphic(line, true)
  }

  async function drawViewShed() {
    cancelDraw()
    map.scene.globe.depthTestAgainstTerrain = true
    map.scene.postProcessStages.fxaa.enabled = true
    return sketches.startDraw({ type: 'viewShed', style: { angle: 60, angle2: 45, addHeight: 1.5, opacity: 0.5, showFrustum: true } })
  }

  function setSunlight(time: string) {
    if (!shadows) {
      shadows = new mars3d.thing.Shadows({ time: new Date(time) })
      map.addThing(shadows)
    } else shadows.time = new Date(time)
  }

  function setUnderground(alpha: number) {
    if (!underground) { underground = new mars3d.thing.Underground({ alpha }); map.addThing(underground) }
    underground.alpha = alpha
  }

  async function analyzeArea(kind: 'terrain' | 'slope' | 'clip' | 'flat' | 'limit', height: number, bottomHeight = 0) {
    if ((kind === 'terrain' || kind === 'slope') && !map.hasTerrain) throw new Error('请先在“底图”面板启用地形服务')
    const area = await draw('polygon', '', '#ffff00', true)
    if (!area) return
    const positions = area.positionsShow
    sketches.removeGraphic(area, true)
    if (kind === 'terrain') {
      if (!terrainClip) {
        terrainClip = new mars3d.thing.TerrainClip({ stylePit: { image: `${import.meta.env.BASE_URL}img/textures/poly-stone.jpg`, imageBottom: `${import.meta.env.BASE_URL}img/textures/poly-soil.jpg`, splitNum: 80 } })
        map.addThing(terrainClip)
      }
      map.scene.globe.depthTestAgainstTerrain = true
      terrainClip.addArea(positions, { diffHeight: height })
    } else if (kind === 'slope') {
      if (!slope) { slope = new mars3d.thing.Slope({ arrow: { color: mars3d.Cesium.Color.YELLOW, scale: 0.3, width: 15 } }); map.addThing(slope) }
      if (!contour) { contour = new mars3d.thing.ContourLine({ contourShow: false, shadingType: 'slope', shadingAlpha: 0.6 }); map.addThing(contour) }
      slope.clear()
      contour.positions = positions
      slope.add(positions, { splitNum: 10, radius: 1, count: 4 })
    } else if (kind === 'limit') {
      if (!limitHeight) { limitHeight = new mars3d.thing.LimitHeight({ color: 'rgba(255,0,0,0.5)', height, bottomHeight }); map.addThing(limitHeight) }
      limitHeight.height = height
      limitHeight.bottomHeight = bottomHeight
      limitHeight.positions = positions
    } else {
      const layer = map.pickTilesetLayer(positions)
      if (!layer) throw new Error('绘制区域内没有 3D Tiles 模型，请先加载模型并在模型上绘制')
      editedModels.add(layer)
      if (kind === 'clip') { layer.planClip.positions = positions; layer.planClip.clipOutSide = false }
      else layer.flat.addArea(positions, { height })
    }
  }

  function clearAnalysis() {
    cancelDraw()
    stopRoute()
    sketches.clear()
    sightline.clear()
    if (shadows) map.removeThing(shadows, true)
    shadows = undefined
    for (const thing of [terrainClip, underground, slope, contour, limitHeight]) {
      if (thing) map.removeThing(thing, true)
    }
    terrainClip = undefined
    underground = undefined
    slope = undefined
    contour = undefined
    limitHeight = undefined
    editedModels.forEach(layer => { layer.planClip.clear(); layer.flat.clear() })
    editedModels.clear()
    map.scene.globe.depthTestAgainstTerrain = originalDepthTest
    map.scene.postProcessStages.fxaa.enabled = originalFxaa
  }

  function destroy() {
    disposed = true
    stopCompare()
    clearAnalysis()
    map.removeThing(measure, true)
    map.removeThing(sightline, true)
    map.removeLayer(drawings, true)
    map.removeLayer(sketches, true)
  }

  return { drawings, sketches, measure, draw, cancelDraw, startRoute, stopRoute, startSplit, startCompare, stopCompare, analyzeVisibility, drawViewShed, setSunlight, setUnderground, analyzeArea, clearAnalysis, destroy }
}

export type MapTools = ReturnType<typeof createMapTools>
