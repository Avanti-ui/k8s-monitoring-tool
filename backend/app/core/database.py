from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo():
    global client, db
    print(f"[Database] Connecting to MongoDB at {settings.MONGO_URI}...")
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client.get_default_database()
    print("[Database] MongoDB connected successfully")


async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("[Database] MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    global db
    if db is None:
        client_instance = AsyncIOMotorClient(settings.MONGO_URI)
        return client_instance.get_default_database()
    return db
