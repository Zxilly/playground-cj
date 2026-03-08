// HTTP and Socket APIs require network access.
// Below is the shape of an HTTP client request
// using stdx.net.http (requires stdx in cjpm.toml).
//
//   import stdx.net.http.*
//
//   main() {
//       let client = ClientBuilder().build()
//       let resp = client.get("http://example.com/hello")
//       let buf = Array<Byte>(1024, repeat: 0)
//       let n = resp.body.read(buf)
//       println(String.fromUtf8(buf[..n]))
//       client.close()
//   }

main() {
    println("HTTP: use ClientBuilder / ServerBuilder from stdx.net.http")
    println("TCP:  use TcpSocket / TcpServerSocket from std.net")
    println("UDP:  use UdpSocket from std.net")
}
