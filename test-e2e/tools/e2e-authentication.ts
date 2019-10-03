import { DeepstreamPlugin, DeepstreamAuthentication } from '../../ds-types/src/index'
import { JSONObject } from '../../src/constants'

interface AuthData {
    token?: string,
    username?: string,
    password?: string
}

export class E2EAuthentication extends DeepstreamPlugin implements DeepstreamAuthentication {
  public description: string = 'E2E Authentication'
  public tokens = new Map<string, {
    username?: string,
    token?: string,
    clientData?: JSONObject,
    serverData?: JSONObject
  }>()
  public onlyLoginOnceUser: boolean = false

  public async isValidUser (headers: JSONObject, authData: AuthData) {
    if (authData.token) {
        if (authData.token === 'letmein') {
            return { isValid: true, authData: { username: 'A' } }
        }

        // authenticate token
        const response = this.tokens.get(authData.token)
        if (response && response.username) {
            return { isValid: true, authData: response }
        }
    }

    const username = authData.username
    const token = Math.random().toString()
    let clientData: any = null
    const serverData: any = {}
    let success

    // authenticate auth data
    const users = ['A', 'B', 'C', 'D', 'E', 'F', 'W', '1', '2', '3', '4', 'OPEN']
    if (users.indexOf(username!) !== -1 && authData.password === 'abcdefgh') {
        success = true
    } else if (username === 'userA' && authData.password === 'abcdefgh') {
        success = true
        serverData.role = 'user'
    } else if (username === 'userB' && authData.password === '123456789') {
        success = true
        clientData = { 'favorite color': 'orange', 'id': username }
        serverData.role = 'admin'
    } else if (username === 'randomClientData') {
        success = true
        clientData = { value : Math.random() }
    } else if (username === 'onlyLoginOnce' && !this.onlyLoginOnceUser) {
        this.onlyLoginOnceUser = true
        success = true
    } else {
        success = false
    }

    const authResponseData = { username, token, clientData, serverData }

    if (success) {
        this.tokens.set(token, authData)
        return { isValid: true, authData: authResponseData }
    } else {
        return { isValid: false }
    }
  }
}
