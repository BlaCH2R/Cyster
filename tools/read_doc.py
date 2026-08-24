import email
import re

p = r"D:\sd\Cytoid flies\StoryBoard 格式详解 - Cytoid Wiki.mhtml"
with open(p, "rb") as f:
    msg = email.message_from_bytes(f.read())

parts = []
for part in msg.walk():
    ct = part.get_content_type()
    if ct in ("text/html", "text/plain"):
        try:
            payload = part.get_payload(decode=True)
            if payload:
                parts.append(payload.decode("utf-8", "ignore"))
        except Exception:
            pass

html = "\n".join(parts)
print("html len", len(html))
# strip tags
text = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.I)
text = re.sub(r"<style[\s\S]*?</style>", "", text, flags=re.I)
text = re.sub(r"<[^>]+>", "\n", text)
text = re.sub(r"\n{2,}", "\n", text)
text = re.sub(r"[ \t]+", " ", text)
lines = [l.strip() for l in text.split("\n") if l.strip()]
out = "\n".join(lines)
with open(r"V:\cytoid storyboarder\tools\doc_text.txt", "w", encoding="utf-8") as f:
    f.write(out)
print("text len", len(out))
print(out[:2000])
