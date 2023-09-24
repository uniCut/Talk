# Verwendung des offizilen Node.js Image als Basis
FROM node:18

# Legt mein Start-Ordner fest
WORKDIR /app

# Kopiert die package.json-Datei in den Ordner /app/package.json
COPY package.json /app/package.json

# Installier den NPM-Paketmanager für dependencies
RUN npm install

# Source-Code von meinem Ordner wird in Start Ordner reinkopiert
COPY . .

# Braucht es nicht umbedingt legt aber den Port fest
EXPOSE 3000

# Startet den Server wenn der Container gestartet ist
CMD ["node", "app.js"]
