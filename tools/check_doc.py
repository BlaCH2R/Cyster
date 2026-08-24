import email, re, html
from email import policy
path = r"D:\sd\Cytoid flies\StoryBoard 格式详解 - Cytoid Wiki.mhtml"
with open(path, "rb") as f:
    msg = email.message_from_binary_file(f, policy=policy.default)
for part in msg.walk():
    if part.get_content_type() == "text/html":
        payload = part.get_payload(decode=True)
        text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        for key in ["tape", "vignette", "chromatic", "chromatical"]:
            print("====", key, "====")
            for m in re.finditer(key, text, re.I):
                s = max(0, m.start()-260); e = min(len(text), m.end()+300)
                frag = re.sub(r"<[^>]+>", " ", text[s:e])
                frag = re.sub(r"\s+", " ", frag)
                try:
                    print(frag[:480].encode("gbk", errors="replace").decode("gbk"))
                except Exception:
                    print(frag[:480])
                print("---")
        break
