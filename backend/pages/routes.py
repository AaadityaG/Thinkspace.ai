import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from auth.deps import get_current_user
from db.database import get_db

router = APIRouter(prefix="/pages", tags=["pages"])


class PageIn(BaseModel):
    name: str = Field(default="Untitled", min_length=1, max_length=120)


class SnapshotIn(BaseModel):
    snapshot: dict


class MessageIn(BaseModel):
    role: str = Field(pattern="^(user|agent)$")
    content: str = Field(min_length=1, max_length=20000)


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def _page_out(doc: dict, *, with_snapshot: bool = False) -> dict:
    out = {
        "id": doc["_id"],
        "name": doc["name"],
        "created_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
    }
    if with_snapshot:
        out["snapshot"] = doc.get("snapshot")
    return out


async def _owned_page(db, page_id: str, user_id: str) -> dict:
    page = await db.pages.find_one({"_id": page_id, "user_id": user_id})
    if not page:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    return page


@router.get("")
async def list_pages(user: dict = Depends(get_current_user), db=Depends(get_db)):
    pages = []
    async for doc in db.pages.find({"user_id": user["id"]}).sort("updated_at", -1):
        pages.append(_page_out(doc))
    return {"pages": pages}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_page(
    body: PageIn, user: dict = Depends(get_current_user), db=Depends(get_db)
):
    now = datetime.now(timezone.utc)
    doc = {
        "_id": uuid.uuid4().hex,
        "user_id": user["id"],
        "name": body.name.strip() or "Untitled",
        "snapshot": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.pages.insert_one(doc)
    return {"page": _page_out(doc)}


@router.get("/{page_id}")
async def get_page(
    page_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)
):
    page = await _owned_page(db, page_id, user["id"])
    return {"page": _page_out(page, with_snapshot=True)}


@router.put("/{page_id}/snapshot")
async def save_snapshot(
    page_id: str,
    body: SnapshotIn,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    page = await _owned_page(db, page_id, user["id"])
    now = datetime.now(timezone.utc)

    await db.pages.update_one(
        {"_id": page["_id"]},
        {"$set": {"snapshot": body.snapshot, "updated_at": now}},
    )
    return {"saved_at": _iso(now)}


@router.patch("/{page_id}")
async def rename_page(
    page_id: str,
    body: PageIn,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    await _owned_page(db, page_id, user["id"])
    await db.pages.update_one(
        {"_id": page_id}, {"$set": {"name": body.name.strip() or "Untitled"}}
    )
    return {"ok": True}


@router.get("/{page_id}/messages")
async def list_messages(
    page_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)
):
    await _owned_page(db, page_id, user["id"])
    messages = []
    async for doc in db.chatMessages.find({"page_id": page_id}).sort("seq", 1):
        messages.append(
            {
                "id": doc["_id"],
                "role": doc["role"],
                "content": doc["content"],
                "seq": doc["seq"],
                "created_at": _iso(doc.get("created_at")),
            }
        )
    return {"messages": messages}


@router.post("/{page_id}/messages", status_code=status.HTTP_201_CREATED)
async def add_message(
    page_id: str,
    body: MessageIn,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    await _owned_page(db, page_id, user["id"])
    last = await db.chatMessages.find_one(
        {"page_id": page_id}, sort=[("seq", -1)]
    )
    seq = (last["seq"] + 1) if last else 1
    now = datetime.now(timezone.utc)
    doc = {
        "_id": uuid.uuid4().hex,
        "user_id": user["id"],
        "page_id": page_id,
        "role": body.role,
        "content": body.content,
        "seq": seq,
        "created_at": now,
    }
    await db.chatMessages.insert_one(doc)
    return {
        "message": {
            "id": doc["_id"],
            "role": doc["role"],
            "content": doc["content"],
            "seq": seq,
            "created_at": _iso(now),
        }
    }


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(
    page_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)
):
    await _owned_page(db, page_id, user["id"])
    await db.pages.delete_one({"_id": page_id})
    await db.page_versions.delete_many({"page_id": page_id})
    await db.chatMessages.delete_many({"page_id": page_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
