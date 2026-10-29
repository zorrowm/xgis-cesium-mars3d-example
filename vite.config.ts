import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import {mars3dPlugin} from 'vite-plugin-mars3d';

// https://vite.dev/config/ { cesiumPackageName: "cesium" }
export default defineConfig({
  plugins: [vue(), mars3dPlugin({ useStatic: true, injectCss: false })],
  // The library imports the same static Cesium instance; do not prebundle it separately.
  optimizeDeps: { exclude: ['xgis-cesium-mars3d'] },
})
