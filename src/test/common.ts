import * as chai from 'chai'
import * as sinonChai from 'sinon-chai'
chai.use(sinonChai)

export const swallow = (thrower) => {
    try {
        thrower()
    } catch (e) {
        // Intentionally swallow
    }
}
