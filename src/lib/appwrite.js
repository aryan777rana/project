import { Client, Account, Databases, Storage, Functions } from "appwrite";

const client = new Client()
    .setEndpoint("https://sgp.cloud.appwrite.io/v1")
    .setProject("69d2a9900032fd99f3b7");

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const functions = new Functions(client);

export { client, account, databases, storage, functions };
