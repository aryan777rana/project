import { Client, TablesDB } from "appwrite";

const client = new Client();

client.setEndpoint("https://sgp.cloud.appwrite.io/v1");
client.setProject("69d2a9900032fd99f3b7");

const db = new TablesDB(client);

export {client, db};