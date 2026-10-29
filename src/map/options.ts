// Adapted from vue-gis-template/public/config/config - 副本.json.
// Use the same basemap registry for the picker and comparison tools.
export const basemaps = [
  { id: 'gaode-img', name: '高德影像', type: 'gaode', layer: 'img_d', show: true },
  { id: 'gaode-vec', name: '高德电子', type: 'gaode', layer: 'vec' },
  { id: 'gaode-dark', name: '高德深色', type: 'gaode', layer: 'vec', invertColor: true, filterColor: '#4e70a6' },
  { id: 'osm', name: 'OpenStreetMap', type: 'xyz', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maximumLevel: 19 },
]

export const locationTemplate = '<div>经度：{lng}</div><div>纬度：{lat}</div><div>海拔：{alt}米</div><div>层级：{level}</div><div>航向角：{heading}°</div><div>视角：{pitch}°</div><div>视高：{cameraHeight}米</div><div>帧频：{fps}FPS</div>'

export const mapOptions = {
  scene: { center: { lng: 105, lat: 30, alt: 19505190, heading: 0, pitch: -90 } },
  control: {
    toolbar: { position: 'left-bottom' },
    homeButton: true,
    fullscreenButton: true,
    sceneModePicker: true,
    baseLayerPicker: false,
    navigationHelpButton: true,
    zoom: { insertIndex: 1 },
    compass: { style: { bottom: 'toolbar', left: '5px' } },
  },
  terrain: { url: 'https://data.mars3d.cn/terrain', show: false },
  basemaps,
}
