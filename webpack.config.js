const path = require('path');

module.exports = {
  entry: {
    app: {
      import: './src/app.ts',
      dependOn: 'three',
    },
    volume_painter: {
      import: './src/volume_painter.ts',
      dependOn: 'three',
    },
    geo_painter: {
      import: './src/geo_painter.ts',
      dependOn: 'three',
    },
    util: {
      import: './src/util.ts',
      dependOn: 'three',
    },
    index: {
      import: './src/index.ts',
    },
    three: 'three',
  },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.worker\.(js|ts)$/i,
        use: [{
          loader: 'comlink-loader',
        }],
      },
      {test: /\.frag$/, use: 'raw-loader'},
      {test: /\.vert$/, use: 'raw-loader'},
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'static'),
  },
  watch: false,
};
