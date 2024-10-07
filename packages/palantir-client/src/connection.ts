import { MessageChannel } from "./messages";

export class Connection {
	private readonly channel: MessageChannel;

	constructor(url: string | URL) {
		this.channel = new MessageChannel(url);
	}
}
