/**
 * Uses options
 * 		uniqueTimeout
 *   	leaderResponseTimeout
 *
 * Uses topics
 * 		C.TOPIC.LEADER
 * 		C.TOPIC.LEADER_PRIVATE_<serverName>
 *
 */
module.exports = class UniqueRegistry{
	constructor() {

	}

	get( name, callback ) {
		// callback will be invoked with <bool> success
	}

	release( name ) {
		// will also happen on unique timeout
	}
}
