let env = process.env.NODE_ENV || 'development'

if (env === 'development' || env === 'test') {
  //when we require a json file in node it automatically parses it
  const config = require('./config.json')

  //loop over and set on process.env
  Object.keys(config).forEach(key => {
    process.env[key] = config[key]
  })
}
