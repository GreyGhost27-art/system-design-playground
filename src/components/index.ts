// Every component file, in sidebar order (categories follow
// categories.json). A test fails if a file here is missing from the list.
import client from './external/client.json' with { type: 'json' };
import externalService from './external/external-service.json' with { type: 'json' };
import dns from './edge/dns.json' with { type: 'json' };
import cdn from './edge/cdn.json' with { type: 'json' };
import loadBalancer from './routing/load-balancer.json' with { type: 'json' };
import apiGateway from './routing/api-gateway.json' with { type: 'json' };
import rateLimiter from './routing/rate-limiter.json' with { type: 'json' };
import websocketGateway from './routing/websocket-gateway.json' with { type: 'json' };
import shardRouter from './routing/shard-router.json' with { type: 'json' };
import appServer from './compute/app-server.json' with { type: 'json' };
import worker from './compute/worker.json' with { type: 'json' };
import serverlessFunction from './compute/function.json' with { type: 'json' };
import sqlDatabase from './data/sql-database.json' with { type: 'json' };
import nosqlDatabase from './data/nosql-database.json' with { type: 'json' };
import cache from './data/cache.json' with { type: 'json' };
import objectStorage from './data/object-storage.json' with { type: 'json' };
import searchIndex from './data/search-index.json' with { type: 'json' };
import queue from './async/queue.json' with { type: 'json' };
import pubSub from './async/pub-sub.json' with { type: 'json' };
import stream from './async/stream.json' with { type: 'json' };
import logs from './observability/logs.json' with { type: 'json' };
import metrics from './observability/metrics.json' with { type: 'json' };
import tracing from './observability/tracing.json' with { type: 'json' };
import alerting from './observability/alerting.json' with { type: 'json' };
import errorTracking from './observability/error-tracking.json' with { type: 'json' };

export default [
  client,
  externalService,
  dns,
  cdn,
  loadBalancer,
  apiGateway,
  rateLimiter,
  websocketGateway,
  shardRouter,
  appServer,
  worker,
  serverlessFunction,
  sqlDatabase,
  nosqlDatabase,
  cache,
  objectStorage,
  searchIndex,
  queue,
  pubSub,
  stream,
  logs,
  metrics,
  tracing,
  alerting,
  errorTracking,
];
