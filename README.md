# PortoEvents

Sistema simples para agregar eventos da cidade do Porto via scraping de sites configuraveis, com persistencia em JSON e interface web com filtro por data.

## O que existe nesta versao

- Scraping configuravel por lista de fontes
- Fonte inicial: Agenda Porto (`https://www.agenda-porto.pt/`)
- Persistencia em `data/events.json`
- API para listar eventos, atualizar scraping e gerir fontes
- Pagina web simples para visualizar eventos e filtrar por data

## Como correr

```bash
npm install
npm start
```

Abre no browser: `http://localhost:3000`

## Endpoints principais

- `GET /api/events` -> lista eventos
- `GET /api/events?date=YYYY-MM-DD` -> filtra por data
- `POST /api/events/refresh` -> corre o scraping e atualiza o JSON
- `GET /api/sources` -> lista fontes de scraping
- `POST /api/sources` -> adiciona/atualiza uma fonte
- `DELETE /api/sources/:id` -> remove uma fonte

## Estrutura

- `src/config/sources.json` -> lista de sites para scraping
- `src/scrapers/agendaPorto.js` -> scraper especifico da Agenda Porto
- `src/services/scrapeService.js` -> orquestracao do scraping
- `src/services/eventsStore.js` -> leitura/escrita do ficheiro JSON
- `src/server.js` -> API e servidor web
- `public/` -> frontend simples

## Exemplo para adicionar fonte

`POST /api/sources`

```json
{
  "id": "agenda-porto",
  "name": "Agenda Porto",
  "url": "https://www.agenda-porto.pt/",
  "city": "Porto",
  "scraper": "agenda-porto",
  "enabled": true,
  "maxItems": 60
}
```

Nota: para um novo site, alem da fonte no JSON, e necessario criar um scraper novo em `src/scrapers/` e registra-lo em `src/services/scrapeService.js`.
