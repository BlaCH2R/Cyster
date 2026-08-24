import email, html, re, sys
from email import policy

path = r"D:\sd\Cytoid flies\StoryBoard 格式详解 - Cytoid Wiki.mhtml"
out = r"V:\cytoid storyboarder\docs\storyboard_doc.txt"

with open(path, "rb") as f:
    msg = email.message_from_binary_file(f, policy=policy.default)

for part in msg.walk():
    ct = part.get_content_type()
    if ct == "text/html":
        payload = part.get_payload(decode=True)
        charset = part.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace")
        text = re.sub(r"(?is)<script.*?</script>", " ", text)
        text = re.sub(r"(?is)<style.*?</style>", " ", text)
        text = re.sub(r"(?is)<br\s*/?>", "\n", text)
        text = re.sub(r"(?is)</(p|div|h1|h2|h3|h4|h5|li|tr|pre|table)>", "\n", text)
        text = re.sub(r"(?is)<li[^>]*>", "\n- ", text)
        text = re.sub(r"(?is)</h([1-6])>", lambda m: "\n\n" + "#" * int(m.group(1)) + " ", text)
        text = re.sub(r"(?is)<[^>]+>", "", text)
        text = html.unescape(text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        with open(out, "w", encoding="utf-8") as f2:
            f2.write(text)
        print("LENGTH:", len(text))
        break
