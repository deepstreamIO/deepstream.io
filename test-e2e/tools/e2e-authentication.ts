import { DeepstreamPlugin, DeepstreamAuthentication } from '@deepstream/types'
import { JSONObject } from '../../src/constants'

interface AuthData {
    token?: string,
    username?: string,
    password?: string
}

export class E2EAuthentication extends DeepstreamPlugin implements DeepstreamAuthentication {
  public description: string = 'E2E Authentication'
  public tokens = new Map<string, {
    id?: string,
    token?: string,
    clientData?: JSONObject,
    serverData?: JSONObject
  }>()
  public onlyLoginOnceUser: boolean = false

  public async isValidUser (headers: JSONObject, authData: AuthData) {
    if (authData.token) {
        if (authData.token === 'letmein') {
            return { isValid: true, id: 'A' }
        }

        // authenticate token
        const response = this.tokens.get(authData.token)
        if (response && response.id) {
            return { isValid: true, ...response }
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

    const authResponseData = { id: username, token, clientData, serverData }

    if (success) {
        this.tokens.set(token, authResponseData)
        return { isValid: true, ...authResponseData }
    } else {
        return { isValid: false }
    }
  }
}
