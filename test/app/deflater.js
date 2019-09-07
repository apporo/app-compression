function deflateTar (args = {}) {
  const { descriptors, writer } = args;
  return new Bluebird(function(resolved, rejected) {
    tar.create(
      {
        gzip: true,
        cwd: descriptors,
      },
      [ './' ]
    )
    .on('error', function(err) {
      rejected(err);
    })
    .on('finish', function() {
      resolved();
    })
    .pipe(writer);
  });
}