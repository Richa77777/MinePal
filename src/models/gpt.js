import axios from 'axios';
import { HTTPS_BACKEND_URL } from '../constants.js';
import { Buffer } from 'buffer';
const minepal_response_schema = {
    type: "object",
    properties: {
        chat_response: { type: "string" },
        execute_command: { type: "string" }
    },
    required: ["chat_response", "execute_command"],
    additionalProperties: false
};
export class GPT {
    constructor(model_name) {
        this.model_name = model_name;
        console.log(`Using model: ${model_name}`);
    }

    // only used by promptmem
    async sendRequest(turns, systemMessage, stop_seq='***', memSaving=false) {
        let messages = [{'role': 'system', 'content': systemMessage}].concat(turns);
        let res = null;

        try {
            const requestBody = {
                model_name: this.model_name,
                messages: messages,
                stop_seq: stop_seq,
            };

            if (!memSaving) {
                requestBody.response_format = {
                    type: "json_schema",
                    json_schema: {
                        name: "minepal_response",
                        schema: minepal_response_schema,
                        strict: true
                    }
                };
            }

            const response = await axios.post(`${HTTPS_BACKEND_URL}/openai/chat`, requestBody);
            res = response.data;
        } catch (err) {
            console.error("Request failed:", err);
            res = "My brain disconnected.";
        }
        return res;
    }

    // for in game chat
    async sendChatRequest(turns, systemMessage, stop_seq='***', memSaving=false) {
        let messages = [{'role': 'system', 'content': systemMessage}].concat(turns);
        // console.log("=== BEGIN MESSAGES ===");
        // messages.forEach((msg, index) => {
        //     console.log(`Message ${index + 1}:`);
        //     console.log(`Role: ${msg.role}`);
        //     console.log(`Content: ${msg.content}`);
        //     console.log("---");
        // });
        // console.log("=== END MESSAGES ===");
        let res = {
            chat_response: null,
            execute_command: null,
            audio: null
        };

        try {
            const requestBody = {
                model_name: this.model_name,
                messages: messages,
                stop_seq: stop_seq,
            };

            if (!memSaving) {
                requestBody.response_format = {
                    type: "json_schema",
                    json_schema: {
                        name: "minepal_response",
                        schema: minepal_response_schema,
                        strict: true
                    }
                };
            }

            const response = await axios.post(`${HTTPS_BACKEND_URL}/chat`, requestBody, {
                responseType: 'arraybuffer',  // Important: handle binary data
            });

            const boundary = response.headers['content-type'].split('boundary=')[1];
            const buffer = Buffer.from(response.data);

            // Split the buffer using the boundary
            const parts = buffer.toString('binary').split(`--${boundary}`);

            // Extract text content
            const textPart = parts.find(part => part.includes('Content-Type: text/plain'));
            const textContent = textPart.split('\r\n\r\n')[1].trim();

            // Extract audio buffer directly
            const audioPart = parts.find(part => part.includes('Content-Type: audio'));
            const audioBuffer = Buffer.from(audioPart.split('\r\n\r\n')[1].trim(), 'binary');

            const parsedTextContent = JSON.parse(textContent);
            res = {
                chat_response: parsedTextContent.chat_response,
                execute_command: parsedTextContent.execute_command,
                audio: audioBuffer
            };
        } catch (err) {
            console.error("Request failed:", err);
            res = {
                chat_response: "My brain disconnected.",
                execute_command: null,
                audio: null
            };
        }
        return res;
    }

    async embed(text) {
        try {
            const response = await axios.post(`${HTTPS_BACKEND_URL}/openai/embed`, {
                model_name: this.model_name,
                text: text,
            });
            return response.data;
        } catch (err) {
            if (err.response && err.response.status === 500) {
                console.log('Error 500:', err.response.data);
            } else {
                console.log('Error:', err.message);
            }
            throw new Error('Failed to get embedding');
        }
    }
}