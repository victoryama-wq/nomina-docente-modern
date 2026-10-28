# ASCII-only synthetic PDF fixture. No real documents or network destinations.
function emit(s) { printf "%s", s; offset += length(s) }
function object(n, body) {
  offsets[n] = offset
  emit(n " 0 obj\n" body "\nendobj\n")
}
BEGIN {
  emit("%PDF-1.7\n")
  catalog = "<< /Type /Catalog /Pages 2 0 R"
  if (mode == "js") catalog = catalog " /OpenAction 6 0 R"
  if (mode == "embedded") catalog = catalog " /Names << /EmbeddedFiles << /Names [(synthetic.txt) 7 0 R] >> >>"
  object(1, catalog " >>")
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  object(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>")
  object(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  content = "BT /F1 12 Tf 40 740 Td (Synthetic H24 PD03. No personal data.) Tj ET\n"
  object(5, "<< /Length " length(content) " >>\nstream\n" content "endstream")
  count = 5
  if (mode == "js") {
    object(6, "<< /S /JavaScript /JS (void 0;) >>")
    count = 6
  }
  if (mode == "embedded") {
    if ((getline marker < markerFile) != 1 || length(marker) != 68) exit 2
    close(markerFile)
    object(6, "<< /Type /EmbeddedFile /Length " length(marker) " >>\nstream\n" marker "\nendstream")
    object(7, "<< /Type /Filespec /F (synthetic.txt) /EF << /F 6 0 R >> >>")
    count = 7
  }
  start = offset
  emit("xref\n0 " (count + 1) "\n0000000000 65535 f \n")
  for (i = 1; i <= count; i++) emit(sprintf("%010d 00000 n \n", offsets[i]))
  emit("trailer\n<< /Size " (count + 1) " /Root 1 0 R >>\nstartxref\n" start "\n%%EOF\n")
}
