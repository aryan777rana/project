import { Client, Databases, Storage, ID } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://sgp.cloud.appwrite.io/v1')
    .setProject('69d2a9900032fd99f3b7')
    .setKey('standard_d5e848e186cd6dca02773cba6232e8647e5d6534a306b12bcc8a72f31a402fdae1a9383ff83c3ad1e58df21724940658b436280b3d2390a7b6557993c279f457ed118e88cdb34d25184436bc11b124f5ccfa63592ecad88232cfbd89e2f67a10631e34e6d384d12b19d0d15ed80a4d614c5dcd13dbbf359abcb25482d2e8fcad');

const databases = new Databases(client);
const storage = new Storage(client);

const DB_ID = 'medical_data';
const COLLECTION_ID = 'reports';
const BUCKET_ID = 'reports_bucket';

async function setup() {
    try {
        console.log('Creating database...');
        try {
            await databases.create(DB_ID, 'MedicalData');
            console.log('Database created.');
        } catch (e) {
            if (e.code === 409) console.log('Database already exists.');
            else throw e;
        }

        console.log('Creating collection...');
        try {
            await databases.createCollection(DB_ID, COLLECTION_ID, 'reports');
            console.log('Collection created.');
            
            // Allow users to read, update, delete their own documents (will be handled via document level security)
        } catch (e) {
            if (e.code === 409) console.log('Collection already exists.');
            else throw e;
        }

        console.log('Creating attributes...');
        const createAttr = async (fn, ...args) => {
            try { await fn(...args); console.log(`Created attribute ${args[1]}`); }
            catch (e) { if (e.code === 409) console.log(`Attribute ${args[1]} already exists`); else throw e; }
        };

        // userId, fileId, fileName, status, reportType, extractedText, structuredData
        await createAttr(databases.createStringAttribute.bind(databases), DB_ID, COLLECTION_ID, 'userId', 255, true);
        await createAttr(databases.createStringAttribute.bind(databases), DB_ID, COLLECTION_ID, 'fileId', 255, true);
        await createAttr(databases.createStringAttribute.bind(databases), DB_ID, COLLECTION_ID, 'fileName', 255, true);
        await createAttr(databases.createStringAttribute.bind(databases), DB_ID, COLLECTION_ID, 'status', 255, true); // e.g. Pending, Completed
        await createAttr(databases.createStringAttribute.bind(databases), DB_ID, COLLECTION_ID, 'reportType', 255, false);
        await createAttr(databases.createDatetimeAttribute.bind(databases), DB_ID, COLLECTION_ID, 'reportDate', false);
        await createAttr(databases.createStringAttribute.bind(databases), DB_ID, COLLECTION_ID, 'extractedText', 65535, false);
        await createAttr(databases.createStringAttribute.bind(databases), DB_ID, COLLECTION_ID, 'structuredData', 65535, false); // JSON representation

        console.log('Creating bucket...');
        try {
            await storage.createBucket(
                BUCKET_ID,
                'Reports',
                ['create("users")', 'read("users")', 'update("users")', 'delete("users")'],
                false,
                undefined,
                undefined,
                ['jpg', 'png', 'jpeg', 'pdf']
            );
            console.log('Bucket created.');
        } catch (e) {
            if (e.code === 409) console.log('Bucket already exists.');
            else throw e;
        }
        
        console.log('Setup finished!');
    } catch (err) {
        console.error('Setup failed:', err);
    }
}

setup();
