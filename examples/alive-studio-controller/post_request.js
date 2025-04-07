function send(params) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "http://localhost:5001/send", true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.send("url=" + encodeURIComponent(params));
}
