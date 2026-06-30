const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// On Windows there is no Watchman, so Metro falls back to Node's fs.watch.
// Gradle/CMake create and delete temporary folders under android/**/.cxx and
// build/ during a native build — when a watched folder disappears, the fallback
// watcher throws "ENOENT: watch ...". Excluding native build artifacts from
// Metro's file map prevents the crash.
// One combined RegExp (Metro's blockList expects a single RegExp).
const blockList = new RegExp(
  [
    'android[\\\\/]app[\\\\/]\\.cxx[\\\\/].*',
    'android[\\\\/]app[\\\\/]build[\\\\/].*',
    'android[\\\\/]\\.gradle[\\\\/].*',
    'android[\\\\/]build[\\\\/].*',
    'ios[\\\\/]build[\\\\/].*',
    'ios[\\\\/]Pods[\\\\/].*',
  ].join('|')
);

const config = {
  resolver: {
    blockList,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
