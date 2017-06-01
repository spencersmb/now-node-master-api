const prod = process.env.NODE_ENV === 'production'
/*
https://testone.now.sh/api = myapi.nw.sh/api
because of this translation - the routes on the API need to be looking for /api/__route__
Since Now does it this way - in order to have our app ready for Prod deployment, adding api on the end of
localHost:3000/api -> translates to http://localhost:7777 due to http-proxy - so now our original /api/__route__
will still work in both Dev and Production
*/
exports.variables = {
  BACKEND_URL: prod
    ? 'https://testone.now.sh/api'
    : 'http://localhost:3000/api',
  REFRESH_WINDOW: 15
}
