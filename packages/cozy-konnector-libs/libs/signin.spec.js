const signin = require('./signin')
const cheerio = require('cheerio')

const logger = require('cozy-logger')
logger.setLevel('critical')

jest.mock('./request')
const requestFactory = require('./request')

const form = `
  <span id="im-no-form" />
  <form id="got-no-action"></form>
  <form id="login" action="authenticate">
    <input name="username" type="text" />
    <input name="password" type="password" />
    <input type="submit" />
  </form>`
const resp = '<p>Successfull login</p>'

beforeEach(() => {
  const request = jest.fn()
  request.mockResolvedValueOnce(cheerio.load(form))
  request.mockResolvedValueOnce([200, resp])
  requestFactory.mockReturnValue(request)
})

const url = 'https://espace-client.lanef.com/templates/logon/logon.cfm'
describe('signin', () => {
  describe('happy path', () => {
    it('works', () => {
      return expect(signin(url, '#login', {}, 'raw'))
        .resolves.toEqual(resp)
    })
  })

  describe('formSelector', () => {
    it('throws when matching something else than a form', () => {
      return expect(signin(url, '#im-no-form', {}, 'raw'))
        .rejects.toThrow('INVALID_FORM')
    })

    it('throws when matching a form without action', () => {
      return expect(signin(url, '#got-no-action', {}, 'raw'))
        .rejects.toThrow('INVALID_FORM')
    })

    it('throws when matching no element', () => {
      return expect(signin(url, '#no-match', {}, 'raw'))
        .rejects.toThrow('INVALID_FORM')
    })

    it('continues execution when matched form has action attribute', () => {
      return expect(signin(url, '#login', {}, 'raw'))
        .resolves.toEqual(resp)
    })
  })

  describe('validate function', () => {
    const alwaysInvalid = () => false
    const alwaysValid = () => true

    it('throws LOGIN_FAILED when invalidates', () => {
      return expect(signin(url, '#login', {}, 'raw', alwaysInvalid))
        .rejects.toThrow('LOGIN_FAILED')
    })

    it('continues execution when validates', () => {
      return expect(signin(url, '#login', {}, 'raw', alwaysValid))
        .resolves.toEqual(resp)
    })
  })

  describe('parsing strategy', () => {
    it('throws UNKNOWN_PARSING_STRATEGY when unknown', () => {
      expect(() => signin(url, '#login', {}, 'unknown'))
        .toThrow('UNKNOWN_PARSING_STRATEGY')
    })

    describe('is one of the valid ones', () => {
      for (let strategy of ['raw', 'cheerio', 'json']) {
        it(`resolves when '${strategy}'`, () => {
          return expect(signin(url, '#login', {}, strategy))
            .resolves.toEqual(resp)
          // As request is mocked, resolution is always the same
        })
      }
    })
  })

  describe('connection failure', () => {
    const errors = require('request-promise/errors')

    for (let RErr of [errors.RequestError, errors.StatusCodeError]) {
      describe('at first request', () => {
        describe(RErr.name, () => {
          beforeEach(() => {
            const request = jest.fn()
            request.mockReturnValue(new Promise(() => {
              throw new RErr('dumb')
            }))
            requestFactory.mockReturnValue(request)
          })

          it('rethrows a VENDOR_DOWN error', () => {
            return expect(signin(url, '#login', {}, 'raw'))
              .rejects.toThrow('VENDOR_DOWN')
          })
        })
      })

      describe('at second request', () => {
        describe(RErr.name, () => {
          beforeEach(() => {
            const request = jest.fn()
            request.mockResolvedValueOnce(cheerio.load(form))
            request.mockResolvedValueOnce(new Promise(() => {
              throw new RErr('dumb')
            }))
            requestFactory.mockReturnValue(request)
          })

          it('rethrows a VENDOR_DOWN error', () => {
            return expect(signin(url, '#login', {}, 'raw'))
              .rejects.toThrow('VENDOR_DOWN')
          })
        })
      })
    }
  })
})
