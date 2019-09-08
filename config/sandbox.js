module.exports = {
  plugins: {
    appCompression: {
      compressionLevel: 9,
      errorCodes: {
        InvalidStreamWriter: {
          message: 'The writer must be a writable stream',
          statusCode: 400,
          returnCode: 10001
        },
        ResourceTypeUnsupported: {
          message: 'The resource type is unsupported',
          statusCode: 400,
          returnCode: 10002
        },
        HttpResourceRespStatusIsNotOk: {
          message: 'The HTTP resource return an error status code',
          statusCode: 400,
          returnCode: 10003
        },
        HttpResourceRespBodyIsInvalid: {
          message: 'The HTTP resource return an invalid response body',
          statusCode: 400,
          returnCode: 10004
        },
      }
    }
  }
}
