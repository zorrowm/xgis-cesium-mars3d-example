<template>
  <div class="map-overlay">
    <DemoPanels :get-map="getMap" :tools="tools" @context-menu="mode => emit('context-menu', mode)" @back="toolbar?.close()" />
    <MapToolbar ref="toolbar" :get-map="getMap" :tools="tools" :external-layers="externalLayers" />
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import * as mars3d from 'mars3d'
import { createMapTools, type LayerEntry } from '../map/tools'
import DemoPanels from './DemoPanels.vue'
import MapToolbar from './MapToolbar.vue'

const props = defineProps<{ getMap: () => mars3d.Map; externalLayers: () => LayerEntry[] }>()
const emit = defineEmits<{ 'context-menu': [mode: 'default' | 'demo' | 'none'] }>()
const tools = createMapTools(props.getMap())
const toolbar = ref<InstanceType<typeof MapToolbar>>()
const map = props.getMap()
// Mirror the reference's shortcuts in the left-hand map controls.
const shortcuts = [
  { title: '底图', icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3 1 9l11 6 11-6L12 3zm-9 9-2 1 11 6 11-6-2-1-9 5-9-5z"/></svg>', panel: 'basemap' },
  { title: '图层', icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m12 2-11 6 11 6 11-6-11-6zm-9 9-2 1 11 6 11-6-2-1-9 5-9-5zm0 4-2 1 11 6 11-6-2-1-9 5-9-5z"/></svg>', panel: 'layers' },
  { title: '坐标定位', icon: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v4m0 12v4M2 12h4m12 0h4M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>', panel: 'location' },
].map(item => {
  const control = new mars3d.control.ToolButton({ title: item.title, icon: item.icon, click: () => toolbar.value?.open(item.panel) })
  map.addControl(control)
  return control
})
// Children release their own UI resources before the shared map tools are destroyed.
onUnmounted(() => { shortcuts.forEach(control => map.removeControl(control, true)); tools.destroy() })
</script>
