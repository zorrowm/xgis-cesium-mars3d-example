import { createApp } from 'vue'
import App from './App.vue'
import { Quasar, Dialog, Notify, Loading, QBtn, QMenu, QList, QItem, QItemSection, QTooltip } from 'quasar'
import MarsUIInstall, { setUITheme } from 'quasar-mars-ui'
import 'quasar/dist/quasar.css'
import 'mars3d-cesium/Build/Cesium/Widgets/widgets.css'
import 'quasar-mars-ui/dist/index.css'
import './style.css'
import iconSet from 'quasar/icon-set/svg-material-icons'

const app = createApp(App)
app.use(Quasar, {
  iconSet,
  plugins: { Dialog, Notify, Loading },
  components: { QBtn, QMenu, QList, QItem, QItemSection, QTooltip },
  config: { dark: true },
})
MarsUIInstall(app)
setUITheme('dark')
app.mount('#app')
