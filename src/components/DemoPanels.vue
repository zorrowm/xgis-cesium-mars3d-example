<template>
  <div class="demo-menu" aria-label="示例功能">
    <mars-button @click="back">返回</mars-button>
    <mars-button @click="dialogOpen = !dialogOpen">弹窗示例</mars-button>
    <mars-button @click="uiOpen = !uiOpen">UI面板</mars-button>
    <mars-button @click="updateDialog">测试ui交互</mars-button>
    <mars-button @click="testOpen = !testOpen">test</mars-button>
  </div>

  <mars-dialog v-if="dialogOpen" title="我的弹窗" left="16" top="84" width="280" @closed="dialogOpen = false">
    <div class="panel-content">
      <p aria-live="polite">{{ dialogMessage }}</p>
      <label class="field">条目数量<input type="number" v-model.number="count" min="1" max="100" /></label>
      <ol><li v-for="item in Math.min(100, Math.max(1, count))" :key="item">{{ item }}</li></ol>
    </div>
  </mars-dialog>

  <mars-dialog v-if="uiOpen" title="UI面板" left="16" top="84" width="360" @closed="uiOpen = false">
    <div class="panel-content">
      <details open>
        <summary>表单控件</summary>
        <div class="form-fields">
          <label class="field">简单文本<input v-model="form.text" placeholder="请输入文本" /></label>
          <label class="field">数字输入<input type="number" v-model.number="form.number" step="0.1" /></label>
          <label class="field">下拉选择<select v-model="form.model"><option value="car">小汽车</option><option value="police">警车</option></select></label>
          <label class="field">日期<input type="date" v-model="form.date" /></label>
          <label class="field">亮度<input type="range" v-model.number="form.brightness" min="0" max="2" step="0.05" @input="updateImagery" /></label>
          <label class="field">对比度<input type="range" v-model.number="form.contrast" min="0" max="2" step="0.05" @input="updateImagery" /></label>
          <div class="field"><span>多选</span><div><label v-for="item in ['火星', '地球', '太阳']" :key="item"><input type="checkbox" v-model="form.planets" :value="item" />{{ item }}</label></div></div>
          <div class="field"><span>场景模式</span><div><label v-for="item in sceneModes" :key="item.value"><input type="radio" v-model="form.mode" :value="item.value" @change="changeScene" />{{ item.label }}</label></div></div>
          <label class="field">鼠标操作<input type="checkbox" v-model="form.mouse" @change="map.scene.screenSpaceCameraController.enableInputs = form.mouse" /></label>
          <label class="field">颜色选择<input type="color" v-model="form.color" /></label>
          <div class="actions"><mars-button @click="drawExtent">绘制矩形</mars-button><mars-button @click="tools.cancelDraw()">取消绘制</mars-button></div>
          <output class="extent">{{ extent || '绘制完成后显示矩形范围' }}</output>
        </div>
      </details>
      <div class="actions">
        <mars-button @click="$message(form.text || 'Message消息提示演示')">消息</mars-button>
        <mars-button @click="$notify('Notify提示窗', '该窗口不影响地图交互操作。')">提示</mars-button>
        <mars-button @click="$alert('单击确定关闭弹窗。', 'Alert提示窗')">弹窗</mars-button>
        <mars-button disabled>禁用</mars-button>
      </div>
      <details open><summary>表格控件</summary><table class="panel-table"><thead><tr><th>编号</th><th>名称</th><th>类型</th></tr></thead><tbody><tr v-for="row in tableRows" :key="row.id" tabindex="0" @click="$message(`点击表格的行：${row.name}`)" @keydown.enter="$message(`点击表格的行：${row.name}`)"><td>{{ row.id }}</td><td>{{ row.name }}</td><td>{{ row.type }}</td></tr></tbody></table></details>
      <details open><summary>树控件</summary><mars-tree :tree-data="treeData" checkable v-model:checkedKeys="checkedKeys" v-model:expandedKeys="expandedKeys" @check="checkLayers" /></details>
      <div class="actions"><mars-button @click="loading(false)">进度条1</mars-button><mars-button @click="loading(true)">进度条2</mars-button></div>
    </div>
  </mars-dialog>

  <mars-dialog v-if="testOpen" title="test" right="16" top="160" width="300" @closed="testOpen = false">
    <div class="panel-content"><p>地图交互测试</p><div class="actions"><mars-button @click="cameraView = JSON.stringify(map.getCameraView(), null, 2)">获取当前视角</mars-button><mars-button @click="map.flyHome()">回到初始视角</mars-button><mars-button @click="emit('context-menu', 'default')">默认右键菜单</mars-button><mars-button @click="emit('context-menu', 'demo')">示例右键菜单</mars-button><mars-button @click="emit('context-menu', 'none')">关闭右键菜单</mars-button></div><pre v-if="cameraView">{{ cameraView }}</pre></div>
  </mars-dialog>
</template>

<script setup lang="ts">
// Adapted from reference demo/menu, demo/my-dialog, demo/ui and demo/test.
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import * as mars3d from 'mars3d'
import { Loading } from 'quasar'
import { $alert, $message, $notify, $showLoading, $hideLoading } from 'quasar-mars-ui'
import type { MapTools } from '../map/tools'

const props = defineProps<{ getMap: () => mars3d.Map; tools: MapTools }>()
const emit = defineEmits<{ 'context-menu': [mode: 'default' | 'demo' | 'none']; back: [] }>()
const map = props.getMap()
const tools = props.tools
const dialogOpen = ref(false)
const uiOpen = ref(false)
const testOpen = ref(false)
const dialogMessage = ref('点击“测试ui交互”可更新此窗口。')
const count = ref(10)
const cameraView = ref('')
const extent = ref('')
const form = reactive({ text: '', number: 1, model: 'car', date: '', brightness: 1, contrast: 1, planets: ['地球'], mode: 3, mouse: true, color: '#ffff00' })
const sceneModes = [{ label: '2D', value: 2 }, { label: '2.5D', value: 1 }, { label: '3D', value: 3 }]
const tableRows = [{ id: 1, name: '中国地名', type: '注记' }, { id: 2, name: '标绘示例数据', type: 'GeoJSON' }, { id: 3, name: '我的标记与标绘', type: '矢量' }]
const treeData = ref<Array<{ key: string; title: string; children?: Array<{ key: string; title: string }> }>>([])
const checkedKeys = ref<string[]>([])
const expandedKeys = ref(['layers'])
let loadingTimer: ReturnType<typeof setTimeout> | undefined
let loadingKind: 'overlay' | 'top' | undefined
let rectangleId: string | number | undefined
let imageryDefaults: Array<{ layer: mars3d.Cesium.ImageryLayer; brightness: number; contrast: number }> = []
let previousMouse = true

function updateDialog() { dialogOpen.value = true; dialogMessage.value = `收到更新：测试（${new Date().toLocaleTimeString()}）`; count.value = Math.min(100, count.value + 1) }
function back() { dialogOpen.value = false; uiOpen.value = false; testOpen.value = false; tools.cancelDraw(); emit('back'); map.flyHome() }
function updateImagery() {
  for (let i = 0; i < map.viewer.imageryLayers.length; i++) {
    const layer = map.viewer.imageryLayers.get(i)
    if (!imageryDefaults.some(item => item.layer === layer)) imageryDefaults.push({ layer, brightness: layer.brightness, contrast: layer.contrast })
    layer.brightness = form.brightness
    layer.contrast = form.contrast
  }
}
function changeScene() {
  if (form.mode === 2) map.scene.morphTo2D(0)
  else if (form.mode === 1) map.scene.morphToColumbusView(0)
  else map.scene.morphTo3D(0)
}
async function drawExtent() {
  try {
    removeRectangle()
    const graphic = await tools.draw('rectangle', '', form.color, true)
    if (!graphic) return
    if (!uiOpen.value) { tools.sketches.removeGraphic(graphic, true); return }
    rectangleId = graphic.id
    extent.value = JSON.stringify(graphic.toGeoJSON().geometry.coordinates)
  } catch (error) { $message(error instanceof Error ? error.message : '绘制失败', 'error') }
}
function removeRectangle() {
  if (rectangleId !== undefined) {
    const graphic = tools.sketches.getGraphicById(rectangleId)
    if (graphic) tools.sketches.removeGraphic(graphic, true)
    rectangleId = undefined
  }
}
function stopLoading() {
  clearTimeout(loadingTimer)
  if (loadingKind === 'overlay') Loading.hide()
  if (loadingKind === 'top') $hideLoading()
  loadingKind = undefined
}
function loading(top: boolean) {
  stopLoading()
  loadingKind = top ? 'top' : 'overlay'
  if (top) $showLoading()
  else Loading.show({ message: '加载演示，三秒后结束' })
  loadingTimer = setTimeout(() => { stopLoading(); $message('加载完成') }, 3000)
}
function checkLayers(keys: string[]) {
  treeData.value[0]?.children?.forEach(node => { const layer = map.getLayerById(node.key); if (layer) layer.show = keys.includes(node.key) })
}
function restoreUi() {
  tools.cancelDraw()
  removeRectangle()
  map.scene.screenSpaceCameraController.enableInputs = previousMouse
  imageryDefaults.forEach(({ layer, brightness, contrast }) => { if (!layer.isDestroyed()) { layer.brightness = brightness; layer.contrast = contrast } })
  imageryDefaults = []
  stopLoading()
}
watch(uiOpen, open => {
  if (!open) { restoreUi(); return }
  previousMouse = map.scene.screenSpaceCameraController.enableInputs
  form.mouse = previousMouse
  form.mode = map.scene.mode
  const layers = map.getLayers({ basemaps: false, layers: true }).filter(layer => !layer.isPrivate)
  treeData.value = [{ key: 'layers', title: '地图图层', children: layers.map(layer => ({ key: String(layer.id), title: layer.name || String(layer.id) })) }]
  checkedKeys.value = layers.filter(layer => layer.show).map(layer => String(layer.id))
})
onBeforeUnmount(() => { if (uiOpen.value) restoreUi(); else stopLoading() })
</script>

<style scoped>
.form-fields { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
summary { cursor: pointer; padding-bottom: 8px; }
pre, .extent { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 100%; font-size: 12px; }
ol { max-height: 230px; overflow: auto; margin: 0; }
</style>
