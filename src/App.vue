<template>
  <div>
    <div id="mars3dContainer" class="mars3d-container"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as mars3d from "mars3d"
import { Cesium } from "mars3d"
import { XViewer,LabelGeojsonLayer } from 'xgis-cesium-mars3d';
// import "mars3d/dist/mars3d.css";
import "mars3d/mars3d.css";
import "mars3d-cesium/Build/Cesium/Widgets/widgets.css";
import 'xgis-cesium-mars3d/dist/index.css'
import './getDefaultContextMenu.js';


// 定义全局地图变量
let map: mars3d.Map | null = null;


//初始化地球
function initCesiumViewer() {
  //@ts-ignore
  // if(!window.CESIUM_BASE_URL)
  // {
  //   //@ts-ignore
  //   window.CESIUM_BASE_URL='./cesium/';
  // }
  try {
    //https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html#.ConstructorOptions
    const viewer = new XViewer('mars3dContainer', {
      animation: false, //是否创建动画小器件，左下角仪表
      baseLayerPicker: false, //是否显示图层选择器
      fullscreenButton: false, //是否显示全屏按钮
      geocoder: false, //是否显示geocoder小器件，右上角查询按钮
      homeButton: false, //是否显示home按钮
      infoBox: false, //是否显示信息框
      sceneModePicker: false, //是否显示3D/2D选择器
      selectionIndicator: false, //是否显示选取指示器组件 鼠标绿色框
      timeline: false, // 是否显示时间轴
      navigationHelpButton: false, // 是否显示右上角的帮助按钮
      vrButton: false, // 是否显示双屏
      scene3DOnly: true, // 如果设置为true,则所有几何图形以3d模式绘制以节约gpu资源
      fullscreenElement: document.body, //全屏时渲染的html元素
      navigationInstructionsInitiallyVisible: false,
      contextOptions: {
        // cesium状态下允许canvas转图片convertToImage
        webgl: {
          alpha: false,
          depth: false,
          stencil: true,
          antialias: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: true, //通过canvas.toDataURL()实现截图需要将该项设置为true
          failIfMajorPerformanceCaveat: false
        },
        //https://juejin.cn/post/7265042701065437220
        // requestWebgl1: false,
      },
      //https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html?classFilter=Viewer
      //https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/
      requestRenderMode: true,//优化性能，需要主动触发更新   scene.requestRender();
      targetFrameRate: 60,
      orderIndependentTranslucency: true,
      automaticallyTrackDataSourceClocks: false,
      dataSources: undefined,
      terrainShadows: Cesium.ShadowMode.DISABLED,
      //是正确的
      baseLayer: false,
      // terrainProvider: await Cesium.createWorldTerrainAsync({
      //      requestVertexNormals: true,
      //      requestWaterMask: true,     // 动态水流
      // }),
      //默认地形-无地形
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date());
    return viewer;
  }
  catch (error) {
    // Global.Message.err('Cesium Viewer初始化失败！');
    // Global.Logger().error('Cesium Viewer初始化失败', error);
  }
  return undefined;
}

let graphicLayer // 矢量图层
let graphic // 矢量数据

function rotatePoint_onChangeHandler(event) {
  console.log("绕此处环绕飞行,变化了角度", event)
}

// 在map地图上绑定右键菜单
 function bindMapDefault() {
  // const defaultContextmenuItems = map.getDefaultContextMenu() // 内置的默认右键菜单获取方法
  // map.bindContextMenu(defaultContextmenuItems) // 可以删减defaultContextmenuItems数组内值

  // eslint-disable-next-line no-undef
  const defaultContextmenuItems = getDefaultContextMenu(map) // 是map.getDefaultContextMenu代码相同，用于自定义修改，代码在getDefaultContextMenu.js
  map.bindContextMenu(defaultContextmenuItems) // 可以删减defaultContextmenuItems数组内值
}

// 在map地图上绑定右键菜单
 function bindMapDemo() {
  window._test_show = function (e) {
    return Cesium.defined(e.cartesian)
  }
  window._test_callback = function (e) {
    const mpt = mars3d.LngLatPoint.fromCartesian(e.cartesian)
    console.log(mpt.toString(), "位置信息")
  }

  const mapContextmenuItems = [
    {
      text: "显示此处经纬度",
      icon: `<svg class="iconsvg" aria-hidden="true">
              <use xlink:href="#marsgis-qjsjdb"></use>
            </svg>`, // 支持iconfont的symbol方式图标（svg）
      show: "_test_show",
      callback: "_test_callback" // 也支持window方法的名称配置
    },
    {
      text: "查看当前视角",
      icon: "fa fa-camera-retro", // 支持 font-class 的字体方式图标
      callback: (e) => {
        const mpt = JSON.stringify(map.getCameraView())
        console.log(mpt, "当前视角信息")
      }
    },
    {
      text: "开启深度监测",
      icon: "https://data.mars3d.cn/img/marker/square.png", // 支持base64或url图片
      show: function () {
        return !map.scene.globe.depthTestAgainstTerrain
      },
      callback: (e) => {
        map.scene.globe.depthTestAgainstTerrain = true
      }
    },
    {
      text: "关闭深度监测",
      icon: "fa fa-eye",
      show: function () {
        return map.scene.globe.depthTestAgainstTerrain
      },
      callback: (e) => {
        map.scene.globe.depthTestAgainstTerrain = false
      }
    },
    {
      text: "视角切换",
      // 也支持直接的svg代码
      icon: `<svg t="1651975482546" class="iconsvg" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2783" width="200" height="200"><path d="M714.4 300.3L419.6 104.1 125 300.3l-28.7 19.2L391 515.8l28.7 19.2 28.7-19.2 294.8-196.3-28.8-19.2zM419.6 496.7L153.7 319.5l265.9-177.1 266 177.1-266 177.2z m0 0" p-id="2784"></path><path d="M685.6 319.5l-266 177.2-265.9-177.2 265.9-177.1 266 177.1z m0 0" p-id="2785"></path><path d="M830.3 958.3h-63.8V830.7H638.9v-63.9h127.7V639.2h63.8v127.6h127.7v63.9H830.3v127.6z m0 0" p-id="2786"></path><path d="M742.8 279.7L419.4 64.2 95.9 279.7 64 300.9v357.3l323.5 215.4 31.9 21.3 31.9-21.3L575 791.2v-76.6L451.3 797V550.6l259.6-173v197.8h63.8V300.9l-31.9-21.2zM387.5 797.2l-259.7-173V377.6l259.6 172.9 0.1 246.7z m31.9-302L153.4 318l265.9-177.1 266 177.1-265.9 177.2zM702.7 703v-73.3l-110 73.3h110z m0 0" p-id="2787"></path><path d="M830.3 958.3h-63.8V830.7H638.9v-63.9h127.7V639.2h63.8v127.6h127.7v63.9H830.3v127.6z m0 0" p-id="2788"></path></svg>`,
      children: [
        {
          text: "移动到此处",
          icon: "fa fa-send-o",
          show: "flyToForContextmenuShow",
          callback: "flyToForContextmenuClick" // 也支持“方法名称”方式(如config.json中配置时)
        }
      ]
    }
  ]
  map.bindContextMenu(mapContextmenuItems)

  setTimeout(() => {
    map.openContextMenu(new mars3d.LngLatPoint(116.318747, 31.044486, 651.9))
  }, 5000)
}

// 演示右键菜单“方法名称”方式(如config.json中配置时)
window.flyToForContextmenuShow = function (event) {
  return Cesium.defined(event.cartesian)
}
window.flyToForContextmenuClick = function (event) {
  const cameraDistance = Cesium.Cartesian3.distance(event.cartesian, map.camera.positionWC) * 0.1
  map.flyToPoint(event.cartesian, {
    radius: cameraDistance, // 距离目标点的距离
    maximumHeight: map.camera.positionCartographic.height
  })
}

// 解除Map已绑定的右键菜单
 function unBindMapDemo() {
  map.unbindContextMenu()
}

// 在layer图层上绑定右键菜单
 function bindLayerDemo() {
  graphicLayer.bindContextMenu([
    {
      text: "删除对象",
      icon: "fa fa-trash-o",
      callback: (e) => {
        const graphic = e.graphic
        if (graphic) {
          graphicLayer.removeGraphic(graphic)
        }
      }
    },
    {
      text: "计算长度",
      icon: "fa fa-medium",
      show: function (e) {
        const graphic = e.graphic
        return (
          graphic.type === "polyline" ||
          graphic.type === "curve" ||
          graphic.type === "polylineVolume" ||
          graphic.type === "corridor" ||
          graphic.type === "wall"
        )
      },
      callback: (e) => {
        const graphic = e.graphic
        const strDis = mars3d.MeasureUtil.formatDistance(graphic.distance)
        console.log("该对象的长度为:" + strDis)
      }
    },
    {
      text: "计算周长",
      icon: "fa fa-medium",
      show: function (e) {
        const graphic = e.graphic
        return graphic.type === "circle" || graphic.type === "rectangle" || graphic.type === "polygon"
      },
      callback: (e) => {
        const graphic = e.graphic
        const strDis = mars3d.MeasureUtil.formatDistance(graphic.distance)
        console.log("该对象的周长为:" + strDis)
      }
    },
    {
      text: "计算面积",
      icon: "fa fa-reorder",
      show: function (e) {
        const graphic = e.graphic
        if (!graphic) {
          return false
        }
        return (
          graphic.type === "circle" ||
          graphic.type === "circleP" ||
          graphic.type === "rectangle" ||
          graphic.type === "rectangleP" ||
          ((graphic.type === "polygon" ||
            graphic.type === "polygonP" ||
            graphic.type === "wall" ||
            graphic.type === "scrollWall" ||
            graphic.type === "water") &&
            graphic.positionsShow?.length > 2)
        )
      },
      callback: (e) => {
        const graphic = e.graphic
        const strArea = mars3d.MeasureUtil.formatArea(graphic.area)
        console.log("该对象的面积为:" + strArea)
      }
    }
  ])
}


onMounted(() => {
  const xviewer = initCesiumViewer();

  if (xviewer) {
    map = new mars3d.Map(xviewer as any);
    //默认单张图片，作为底图
    xviewer.setBasicLayer('ARCGIS_IMG');
    xviewer.Weather.rain.enable = true;
    setTimeout(() => {
      xviewer.Weather.rain.destroy();
      xviewer.scene.requestRender();
    }, 5000);

    //加载中国省级行政区矢量注记
    const labelLayer=new LabelGeojsonLayer('chinaPlaces','https://zorrowm.github.io/data/poi/chinaProvince.json');
            labelLayer.attr={
              type:'注记',
              layerID:'chinaPlaces',
              layerName:'中国地名',
              kind:'geojson'
            }
    xviewer.addLayer(labelLayer,true);



    //下面为mars3d测试代码

      // map.on(mars3d.EventType.click, function (event) {
  //   map.contextmenu._rightClickHandler(event)
  // })

  map.on(mars3d.EventType.contextMenuOpen, function (event) {
    console.log("打开了右键菜单")
  })
  map.on(mars3d.EventType.contextMenuClose, function (event) {
    console.log("关闭了右键菜单")
  })
  map.on(mars3d.EventType.contextMenuClick, function (event) {
    console.log("单击了右键菜单", event)

    if (event.data.text === "绕此处环绕飞行") {
      map.contextmenu.rotatePoint.on(mars3d.EventType.change, rotatePoint_onChangeHandler)
    } else if (event.data.text === "关闭环绕飞行") {
      map.contextmenu.rotatePoint.off(mars3d.EventType.change, rotatePoint_onChangeHandler)
    }
  })

  // 为了演示图层上绑定方式
  graphicLayer = new mars3d.layer.GeoJsonLayer({
    name: "标绘示例数据",
    url: "https://data.mars3d.cn/file/geojson/mars3d-draw.json"
  })
  map.addLayer(graphicLayer)

  graphicLayer.on(mars3d.EventType.contextMenuOpen, function (event) {
    event.stopPropagation()
    console.log("打开了graphicLayer右键菜单")
  })
  graphicLayer.on(mars3d.EventType.contextMenuClose, function (event) {
    event.stopPropagation()
    console.log("关闭了graphicLayer右键菜单")
  })
  bindLayerDemo()

  // 为了演示graphic上绑定方式
  graphic = new mars3d.graphic.BoxEntity({
    position: new mars3d.LngLatPoint(116.336525, 31.196721, 323.35),
    style: {
      dimensions: new Cesium.Cartesian3(2000.0, 2000.0, 2000.0),
      fill: true,
      color: "#00ff00",
      opacity: 0.9,
      label: {
        text: "graphic绑定的演示",
        font_size: 25,
        font_family: "楷体",
        color: "#003da6",
        outline: true,
        outlineColor: "#bfbfbf",
        outlineWidth: 2,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      }
    }
  })
  map.graphicLayer.addGraphic(graphic)

  }

})


</script>

<style scoped>
.mars3d-container {
  width: 100%;
  height: 100vh;
}
</style>
