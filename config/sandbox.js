module.exports = {
  plugins: {
    appCompression: {
      errorCodes: {
        InvalidStreamWriter: {
          message: 'The writer must be a stream.Writable'
        }
      }
    }
  }
}