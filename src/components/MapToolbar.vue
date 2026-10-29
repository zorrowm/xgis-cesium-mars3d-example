<template>
  <div class="map-toolbar" aria-label="地图工具栏">
    <q-btn flat no-caps :color="active === 'basemap' ? 'primary' : undefined" @click="open('basemap')"><mars-icon icon="international" width="18" />底图</q-btn>
    <q-btn flat no-caps :color="active === 'layers' ? 'primary' : undefined" @click="open('layers')"><mars-icon icon="layers" width="18" />图层</q-btn>
    <q-btn flat no-caps :color="active && !['basemap', 'layers'].includes(active) ? 'primary' : undefined">
      <mars-icon icon="tool" width="18" />工具 &gt;
      <q-menu anchor="bottom right" self="top right" class="tool-menu" v-model="menuOpen">
        <q-list dense>
          <q-item v-for="item in toolItems" :key="item.id" clickable @click="open(item.id); menuOpen = false">
            <q-item-section avatar><mars-icon :icon="item.icon" width="18" /></q-item-section>
            <q-item-section>{{ item.name }}</q-item-section>
          </q-item>
          <q-item disable title="参考工程仅配置了菜单，未提供路线导航实现"><q-item-section>路线导航（未配置）</q-item-section></q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </div>

  <mars-dialog v-if="active" :key="active" :title="panelTitle" :width="360" right="12" top="80" @closed="close">
    <div class="panel-content">
      <template v-if="active === 'basemap'">
        <div class="actions"><mars-button v-for="base in basemaps" :key="base.id" :class="{ selected: base.id === baseId }" @click="selectBasemap(base.id)">{{ base.name }}</mars-button></div>
        <label class="field">地形服务<input type="checkbox" v-model="terrain" @change="map.hasTerrain = terrain" /></label>
        <p>底图和地形服务需要网络连接。</p>
      </template>

      <template v-else-if="active === 'layers'">
        <mars-button @click="refreshLayers">刷新图层</mars-button>
        <div v-for="layer in layerRows" :key="layer.id" class="layer-row">
          <label><input type="checkbox" v-model="layer.show" @change="toggleLayer(layer.id, layer.show)" /> {{ layer.name }}</label>
          <input v-if="layer.opacity !== undefined" type="range" min="0" max="1" step="0.05" v-model.number="layer.opacity" :aria-label="`${layer.name}透明度`" @input="setOpacity(layer.id, layer.opacity!)" />
          <q-btn flat dense size="sm" label="定位" @click="locateLayer(layer.id)" />
        </div>
        <p v-if="!layerRows.length" class="empty">暂无业务图层</p>
      </template>

      <template v-else-if="active === 'measure'">
        <p>单击地图添加点，双击结束绘制。结果直接显示在地图上。</p>
        <div class="actions"><mars-button v-for="item in measures" :key="item.id" @click="runMeasure(item.id)">{{ item.name }}</mars-button></div>
        <div class="actions"><mars-button @click="tools.cancelDraw">取消绘制</mars-button><mars-button @click="tools.measure.clear()">清除量算</mars-button></div>
        <table v-if="sectionRows.length" class="panel-table"><thead><tr><th>剖面距离（米）</th><th>高程（米）</th></tr></thead><tbody><tr v-for="(row, index) in sectionRows" :key="index"><td>{{ row.distance.toFixed(1) }}</td><td>{{ row.height.toFixed(1) }}</td></tr></tbody></table>
      </template>

      <template v-else-if="active === 'analysis'">
        <p>通视分析需绘制起点与终点；可视域需在地图上指定观察位置和方向。</p>
        <div class="actions"><mars-button @click="perform(tools.analyzeVisibility)">通视分析</mars-button><mars-button @click="perform(tools.drawViewShed)">可视域</mars-button><mars-button @click="runMeasure('volume')">方量分析</mars-button></div>
        <label class="field">日照时间<input type="datetime-local" v-model="sunTime" /></label>
        <div class="actions"><mars-button @click="tools.setSunlight(sunTime)">日照分析</mars-button><mars-button @click="tools.clearAnalysis(); tools.measure.clear()">清除分析</mars-button></div>
        <label class="field">高度/深度<input type="number" v-model.number="analysisHeight" /></label>
        <label class="field">地面海拔<input type="number" v-model.number="bottomHeight" /></label>
        <div class="actions"><mars-button v-for="item in areaAnalyses" :key="item.id" @click="perform(() => tools.analyzeArea(item.id, analysisHeight, bottomHeight))">{{ item.name }}</mars-button></div>
        <label class="field">地表透明<input type="range" min="0" max="1" step="0.05" v-model.number="groundOpacity" @input="tools.setUnderground(groundOpacity)" /></label>
        <p>地形开挖与坡度坡向需要启用地形；模型剖切、压平和限高需在 3D Tiles 模型区域使用。高度/深度和地面海拔的单位均为米。</p>
      </template>

      <template v-else-if="active === 'location'">
        <label class="field">经度<input type="number" v-model.number="location.lng" min="-180" max="180" step="0.000001" /></label>
        <label class="field">纬度<input type="number" v-model.number="location.lat" min="-90" max="90" step="0.000001" /></label>
        <label class="field">高度（米）<input type="number" v-model.number="location.alt" min="0" /></label>
        <div class="actions"><mars-button @click="locate">定位</mars-button><mars-button @click="perform(pickPosition)">地图拾取</mars-button></div>
      </template>

      <template v-else-if="active === 'region'">
        <input class="panel-input" v-model="regionQuery" placeholder="搜索中国地名" aria-label="搜索地区" />
        <div class="actions"><mars-button v-for="(region, index) in filteredRegions" :key="index" @click="map.flyToPoint(region.position, { radius: 200000 })">{{ region.name }}</mars-button></div>
        <p v-if="!filteredRegions.length">未找到匹配地区</p>
        <mars-button @click="map.flyHome()">全国视图</mars-button>
      </template>

      <template v-else-if="active === 'marker' || active === 'plot'">
        <label class="field">名称<input v-model="graphicName" placeholder="输入标记名称" /></label>
        <label class="field">颜色<input type="color" v-model="graphicColor" /></label>
        <div class="actions"><mars-button v-for="kind in active === 'marker' ? drawTypes.slice(0, 1) : drawTypes" :key="kind.id" @click="perform(() => addGraphic(kind.id))">{{ kind.name }}</mars-button></div>
        <div class="actions"><mars-button @click="exportGraphics">导出 GeoJSON</mars-button><mars-button @click="fileInput?.click()">导入 GeoJSON</mars-button><mars-button @click="tools.cancelDraw(); tools.drawings.clear(); refreshGraphics()">清空</mars-button></div>
        <input ref="fileInput" type="file" accept=".json,.geojson" hidden @change="importGraphics" />
        <div v-for="item in graphicRows" :key="item.id" class="layer-row"><span>{{ item.name }}</span><q-btn flat dense label="定位" @click="tools.drawings.getGraphicById(item.id)?.flyTo()" /><q-btn flat dense label="编辑" @click="editGraphic(item.id)" /><q-btn flat dense label="删除" @click="removeGraphic(item.id)" /></div>
        <mars-button v-if="graphicRows.length" @click="tools.drawings.stopEditing()">结束编辑</mars-button>
      </template>

      <template v-else-if="active === 'bookmark'">
        <label class="field">书签名称<input v-model="bookmarkName" placeholder="当前视角" /></label>
        <mars-button @click="saveBookmark">保存当前视角</mars-button>
        <div v-for="(item, index) in bookmarks" :key="item.id" class="layer-row"><span>{{ item.name }}</span><q-btn flat dense label="定位" @click="map.setCameraView(item.view)" /><q-btn flat dense label="删除" @click="bookmarks.splice(index, 1); persistBookmarks()" /></div>
        <p v-if="!bookmarks.length">暂无书签，保存后可在下次打开时恢复。</p>
      </template>

      <template v-else-if="active === 'print'">
        <p>导出当前地图画面为 PNG，可用于打印。</p>
        <mars-button @click="perform(() => map.expImage({ download: true }))">导出地图图片</mars-button>
      </template>

      <template v-else-if="active === 'roam'">
        <p>在地图上绘制飞行路线，双击结束后开始漫游。</p>
        <label class="field">速度 km/h<input type="number" v-model.number="speed" min="1" max="100000" /></label>
        <div class="actions"><mars-button @click="perform(() => tools.startRoute(Math.max(1, speed)))">绘制并漫游</mars-button><mars-button @click="tools.cancelDraw(); tools.stopRoute()">停止</mars-button></div>
      </template>

      <template v-else-if="active === 'split'">
        <label class="field">左侧底图<select v-model="leftBase"><option v-for="base in basemaps" :key="base.id" :value="base.id">{{ base.name }}</option></select></label>
        <label class="field">右侧底图<select v-model="rightBase"><option v-for="base in basemaps" :key="base.id" :value="base.id">{{ base.name }}</option></select></label>
        <mars-button @click="tools.startSplit(leftBase, rightBase)">应用对比</mars-button>
        <p>拖动地图中央的分隔条查看两侧底图，关闭面板恢复地图。</p>
      </template>

      <template v-else-if="active === 'compare' || active === 'four'">
        <p>各地图视角同步，可分别切换底图。关闭面板恢复单幅地图。</p>
        <mars-button @click="close">结束对比</mars-button>
      </template>
    </div>
  </mars-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import * as mars3d from 'mars3d'
import { $message } from 'quasar-mars-ui'
import { basemaps } from '../map/options'
import type { LayerEntry, MapTools } from '../map/tools'

const props = defineProps<{ getMap: () => mars3d.Map; tools: MapTools; externalLayers: () => LayerEntry[] }>()
const map = props.getMap()
const tools = props.tools
const active = ref('')
const menuOpen = ref(false)
const toolItems = [
  { id: 'measure', name: '图上量算', icon: 'ruler' }, { id: 'analysis', name: '空间分析', icon: 'analysis' },
  { id: 'location', name: '坐标定位', icon: 'local' }, { id: 'region', name: '地区导航', icon: 'navigation' },
  { id: 'marker', name: '我的标记', icon: 'mark' }, { id: 'bookmark', name: '视角书签', icon: 'bookmark' },
  { id: 'print', name: '地图打印', icon: 'printer' }, { id: 'roam', name: '飞行漫游', icon: 'take-off' },
  { id: 'plot', name: '图上标绘', icon: 'hand-painted-plate' }, { id: 'split', name: '卷帘对比', icon: 'switch-contrast' },
  { id: 'compare', name: '分屏对比', icon: 'full-screen-play' }, { id: 'four', name: '四屏对比', icon: 'full-screen-play' },
]
const panelTitle = computed(() => ({ basemap: '底图', layers: '图层' }[active.value] || toolItems.find(item => item.id === active.value)?.name || ''))
const currentBasemapId = () => String(typeof map.basemap === 'object' ? map.basemap?.id : map.basemap)
const baseId = ref(currentBasemapId())
const terrain = ref(map.hasTerrain)
const layerRows = ref<Array<{ id: string; name: string; show: boolean; opacity?: number }>>([])
let layerEntries: LayerEntry[] = []
const measures = [
  { id: 'distance', name: '空间距离' }, { id: 'distanceSurface', name: '贴地距离' },
  { id: 'area', name: '水平面积' }, { id: 'areaSurface', name: '贴地面积' },
  { id: 'height', name: '高度差' }, { id: 'heightTriangle', name: '三角测量' },
  { id: 'angle', name: '角度' }, { id: 'point', name: '坐标测量' },
  { id: 'section', name: '地形剖面' },
] as const
const sectionRows = ref<Array<{ distance: number; height: number }>>([])
const onMeasureEnd = (event: any) => {
  if (Array.isArray(event.arrLen) && Array.isArray(event.arrHB)) sectionRows.value = event.arrLen.map((distance: number, index: number) => ({ distance, height: event.arrHB[index] }))
}
tools.measure.on(mars3d.EventType.end, onMeasureEnd)
const location = ref({ lng: 117.229619, lat: 31.8, alt: 1000 })
const localNow = new Date()
localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset())
const sunTime = ref(localNow.toISOString().slice(0, 16))
const analysisHeight = ref(80)
const bottomHeight = ref(0)
const groundOpacity = ref(1)
const areaAnalyses = [{ id: 'terrain', name: '地形开挖' }, { id: 'slope', name: '坡度坡向' }, { id: 'clip', name: '模型剖切' }, { id: 'flat', name: '模型压平' }, { id: 'limit', name: '限高分析' }] as const
const regionQuery = ref('')
const regions = ref<Array<{ name: string; position: number[] }>>([])
const filteredRegions = computed(() => regions.value.filter(item => item.name.includes(regionQuery.value)).slice(0, 60))
const graphicName = ref('我的标记')
const graphicColor = ref('#3388ff')
const graphicRows = ref<Array<{ id: string; name: string }>>([])
const fileInput = ref<HTMLInputElement>()
const drawTypes = [{ id: 'point', name: '点' }, { id: 'polyline', name: '线' }, { id: 'polygon', name: '面' }, { id: 'rectangle', name: '矩形' }, { id: 'circle', name: '圆' }]
const bookmarkName = ref('')
type Bookmark = { id: string; name: string; view: ReturnType<mars3d.Map['getCameraView']> }
const bookmarks = ref<Bookmark[]>([])
try {
  const saved = JSON.parse(localStorage.getItem('mars3d-example-bookmarks') || '[]')
  if (Array.isArray(saved)) bookmarks.value = saved.filter(item => item?.id && item?.name && Number.isFinite(item?.view?.lng) && Number.isFinite(item?.view?.lat))
} catch { /* An unavailable or invalid local cache should not prevent opening the map. */ }
const speed = ref(500)
const leftBase = ref('gaode-img')
const rightBase = ref('gaode-vec')
const abortController = new AbortController()

async function perform(action: () => unknown) {
  try { await action() } catch (error) { $message(error instanceof Error ? error.message : '操作失败，请重试', 'error') }
}

function close() {
  tools.cancelDraw()
  tools.stopRoute()
  tools.stopCompare()
  if (active.value === 'analysis') tools.clearAnalysis()
  tools.drawings.stopEditing()
  active.value = ''
}

async function open(id: string) {
  if (active.value === id) return close()
  close()
  active.value = id
  if (id === 'basemap') { baseId.value = currentBasemapId(); terrain.value = map.hasTerrain }
  if (id === 'layers') refreshLayers()
  if (id === 'marker' || id === 'plot') refreshGraphics()
  if (id === 'split') await perform(() => tools.startSplit(leftBase.value, rightBase.value))
  if (id === 'compare' || id === 'four') await perform(() => tools.startCompare(id === 'four' ? 4 : 2))
  if (id === 'region' && !regions.value.length) await perform(async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}poi/chinaData.json`, { signal: abortController.signal })
    if (!response.ok) throw new Error('地名数据加载失败')
    const data = await response.json()
    regions.value = data.features.filter((item: any) => item.geometry?.type === 'Point').map((item: any) => ({ name: item.properties.tsmc, position: item.geometry.coordinates }))
  })
}

function selectBasemap(id: string) { map.basemap = id; baseId.value = id }
function refreshLayers() {
  layerEntries = props.externalLayers()
  const nativeLayers = map.getLayers({ basemaps: false, layers: true }).filter(layer => !layer.isPrivate && !basemaps.some(base => base.id === layer.id))
  layerRows.value = [
    ...nativeLayers.map(layer => ({ id: String(layer.id), name: layer.name || String(layer.id), show: layer.show, opacity: typeof layer.opacity === 'number' ? layer.opacity : undefined })),
    ...layerEntries.map(({ id, name, show }) => ({ id, name, show })),
  ]
}
function toggleLayer(id: string, show: boolean) {
  const external = layerEntries.find(item => item.id === id)
  if (external) external.setShow(show)
  else { const layer = map.getLayerById(id); if (layer) layer.show = show }
}
function setOpacity(id: string, opacity: number) { const layer = map.getLayerById(id); if (layer) layer.opacity = opacity }
function locateLayer(id: string) { const external = layerEntries.find(item => item.id === id); if (external) external.flyTo?.(); else map.getLayerById(id)?.flyTo() }
function runMeasure(type: typeof measures[number]['id'] | 'volume') {
  tools.cancelDraw()
  perform(() => tools.measure[type]({}))
}
function locate() {
  const { lng, lat, alt } = location.value
  if (![lng, lat, alt].every(value => typeof value === 'number' && Number.isFinite(value)) || Math.abs(lng) > 180 || Math.abs(lat) > 90 || alt < 0) return void $message('请输入有效的经纬度和非负高度', 'warning')
  map.flyToPoint([lng, lat, 0], { radius: Math.max(100, alt) })
}
async function pickPosition() {
  const graphic = await tools.draw('point', '', '#ffff00', true)
  if (!graphic) return
  const point = graphic.centerPoint
  location.value = { lng: point.lng, lat: point.lat, alt: Math.max(0, point.alt) }
  tools.sketches.removeGraphic(graphic, true)
}
function refreshGraphics() { graphicRows.value = tools.drawings.getGraphics().map(graphic => ({ id: String(graphic.id), name: graphic.attr?.name || graphic.type })) }
async function addGraphic(type: string) { await tools.draw(type, graphicName.value, graphicColor.value); refreshGraphics() }
function editGraphic(id: string) { const graphic = tools.drawings.getGraphicById(id); if (graphic) tools.drawings.startEditing(graphic) }
function removeGraphic(id: string) { const graphic = tools.drawings.getGraphicById(id); if (graphic) tools.drawings.removeGraphic(graphic, true); refreshGraphics() }
function exportGraphics() { mars3d.Util.downloadFile('我的标绘.geojson', JSON.stringify(tools.drawings.toGeoJSON())) }
async function importGraphics(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await perform(async () => { await tools.drawings.loadGeoJSON(JSON.parse(await file.text()), { flyTo: true }); refreshGraphics() })
  input.value = ''
}
function persistBookmarks() { try { localStorage.setItem('mars3d-example-bookmarks', JSON.stringify(bookmarks.value)) } catch { $message('浏览器无法保存书签', 'warning') } }
function saveBookmark() { bookmarks.value.push({ id: crypto.randomUUID(), name: bookmarkName.value.trim() || `视角 ${bookmarks.value.length + 1}`, view: map.getCameraView() }); persistBookmarks() }
onBeforeUnmount(() => { abortController.abort(); tools.measure.off(mars3d.EventType.end, onMeasureEnd); close() })
defineExpose({ open, close })
</script>

<style scoped>
.selected { outline: 2px solid #9bceff; }
</style>
