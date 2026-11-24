module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-configures the Reanimated/Worklets plugin.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
