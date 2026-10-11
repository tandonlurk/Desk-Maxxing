// Fails with a friendly message if port 5173 is already taken.
// GitHub sign-in redirects back to http://localhost:5173, so the app can't
// just move to a different port.
import net from 'node:net'

const PORT = 5173

// "localhost" can mean the IPv4 or the IPv6 loopback address depending on the
// computer, so check both.
const HOSTS = ['127.0.0.1', '::1']

// Resolves to true if something is already listening on host:PORT.
function isBusy(host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(true)
      else if (err.code === 'EADDRNOTAVAIL' || err.code === 'EAFNOSUPPORT') resolve(false) // no IPv6 here
      else reject(err)
    })
    server.once('listening', () => server.close(() => resolve(false)))
    server.listen(PORT, host)
  })
}

try {
  for (const host of HOSTS) {
    if (await isBusy(host)) {
      console.error(`
  Port ${PORT} is already in use.

  Desk Maxxing needs exactly http://localhost:${PORT} (GitHub sign-in redirects there).
  Is another copy of the app already running? Close that terminal, or find what's
  using the port:

    macOS / Linux:  lsof -i :${PORT}
    Windows:        netstat -ano | findstr :${PORT}
`)
      process.exit(1)
    }
  }
} catch (err) {
  console.error(`Could not check port ${PORT}:`, err.message)
  process.exit(1)
}
