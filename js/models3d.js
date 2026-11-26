// Apple 官方 AR 模型（USDZ）转换后的 glTF。
// variants：与 media.js / data.js 中配色顺序一一对应；fixed：单色模型对应的配色序号。
// poses：可切换的姿态（折叠 / 开合）；view：[水平角, 俯仰角]（弧度），默认观看角度。
// group：官方模型把 18 Pro 与 Pro Max 放在同一文件里，按模型层级只显示其中一台。
const P = (name) => `assets/3d/${name}.glb`;

export const MODELS = {
  'iphone-duo': { poses: { open: P('iphone-duo-open'), closed: P('iphone-duo-closed') }, pose: 'open', poseLabel: { open: '展开', closed: '合上' }, variants: true, view: [0.55, 0.12] },
  'iphone-18-pro-max': { poses: { default: P('iphone-18-pro') }, fixed: 2, view: [3.55, 0.1], group: 'hWnSpblQztGYOgB' },
  'iphone-18-pro': { poses: { default: P('iphone-18-pro') }, fixed: 2, view: [0.45, 0.1], group: 'DJXWYbiQXUSWOAo' },
  'iphone-air': { poses: { default: P('iphone-air') }, fixed: 0, view: [3.0, 0.1] },
  'iphone-17': { poses: { default: P('iphone-17') }, fixed: 0, view: [3.55, 0.1] },
  'iphone-17e': { poses: { default: P('iphone-17e') }, fixed: 2, view: [3.55, 0.1] },
  'macbook-neo': { poses: { open: P('macbook-neo-open'), closed: P('macbook-neo-closed') }, pose: 'open', poseLabel: { open: '打开', closed: '合上' }, variants: true, view: [0.6, 0.32] },
  'macbook-air': { poses: { default: P('macbook-air') }, variants: true, view: [0.6, 0.32] },
  'macbook-pro': { poses: { open: P('macbook-pro-open'), closed: P('macbook-pro-closed') }, pose: 'open', poseLabel: { open: '打开', closed: '合上' }, variants: true, view: [0.6, 0.32] },
  'macbook-pro-oled': { poses: { open: P('macbook-pro-oled-open'), closed: P('macbook-pro-oled-closed') }, pose: 'open', poseLabel: { open: '打开', closed: '合上' }, variants: true, view: [0.6, 0.32] },
  imac: { poses: { default: P('imac') }, variants: true, view: [0.45, 0.14] },
  'mac-mini': { poses: { default: P('mac-mini') }, fixed: 0, view: [0.6, 0.42] },
  'mac-studio': { poses: { default: P('mac-studio') }, fixed: 0, view: [0.6, 0.38] },
  'ipad-pro': { poses: { default: P('ipad-pro') }, variants: true, view: [0.55, 0.3] },
  'ipad-air': { poses: { default: P('ipad-air') }, variants: true, view: [0.55, 0.3] },
  ipad: { poses: { default: P('ipad') }, variants: true, view: [0.45, 0.12] },
  'airpods-pro-3': { poses: { default: P('airpods-pro-3') }, fixed: 0, view: [0.5, 0.3] },
  'airpods-5': { poses: { default: P('airpods-5') }, fixed: 0, view: [0.5, 0.3] },
  'airpods-max-2': { poses: { default: P('airpods-max-2') }, variants: true, view: [0.6, 0.18] },
  'vision-pro': { poses: { default: P('vision-pro') }, fixed: 0, view: [0.65, 0.16] },
  homepod: { poses: { default: P('homepod') }, fixed: 1, view: [0.4, 0.2] },
};

export const has3D = (id) => !!MODELS[id];
