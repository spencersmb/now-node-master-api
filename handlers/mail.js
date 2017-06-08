const nodemailer = require('nodemailer')
const pug = require('pug')
const juice = require('juice')
const htmlToText = require('html-to-text')
const promisify = require('es6-promisify')

const Mailgun = require('mailgun-js')

const generateHTML = (filename, options = {}) => {
  const html = pug.renderFile(
    `${__dirname}/../views/email/${filename}.pug`,
    options
  )
  const inlined = juice(html)
  return inlined
}

exports.send = async options => {
  const mailgun = new Mailgun({
    apiKey: process.env.MAIL_API,
    domain: process.env.MAIL_DOMAIN
  })

  const html = generateHTML(options.filename, options)

  const mailOptions = {
    from: `Spencer <${process.env.MAIL_USER}>`,
    to: options.user.email,
    subject: options.subject,
    html,
    text: htmlToText.fromString(html)
  }

  // mailgun.messages().send(mailOptions, function(error, body) {
  //   if (!error) {
  //     console.log('sendEmail : email Sent :')
  //   } else {
  //     console.log('sendEmail : Can not send email to : Error : ' + error)
  //   }
  // })

  const response = await mailgun.messages().send(mailOptions)

  if (!response) {
    console.log(
      `sendEmail : Can not send email to : ${options.user.email} Error : ${error}`
    )
    return
  }

  console.log(`sendEmail : email Sent to : ${options.user.email}`)
}

// mailgun.messages().send(emailData, function(error, body) {
//   if (!error) {
//     console.log('sendEmail : email Sent to : spencer.bigum@gmail.com')
//   } else {
//     console.log('sendEmail : Can not send email to : Error : ' + error)
//   }
// })

// var transport = nodemailer.createTransport({
//   host: 'mailtrap.io',
//   port: 2525,
//   // secure: false,
//   // tls: { ciphers: 'SSLv3' },
//   auth: {
//     user: '',
//     pass: ''
//   }
// })

// const transport = nodemailer.createTransport({
//   host: 'mailgun.org',
//   port: 2525,
//   // secure: false,
//   // tls: { ciphers: 'SSLv3' },
//   auth: {
//     user:
//     pass: '
//   }
// })

// transport.sendMail({
//   from: 'Spencer <postmaster@sandbox596fdc7935ca4f1fa42e52eca504ad1c.mailgun.org>',
//   to: ['spencer.bigum@gmail.com'],
//   subject: 'Fancy Email',
//   text: 'still send some text to be on the safe side',
//   // html: { path: 'path/to/email.html' }
//   html: 'This is the HTML text input item'
// })
// also returns a promise.
