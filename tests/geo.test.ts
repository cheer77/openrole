import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geoFromHeaders } from '../lib/geo.ts';
test('geo is disabled until a trusted provider is configured',()=>{
 const headers=new Headers({'x-vercel-ip-country':'ES','x-vercel-ip-city':'Madrid','x-unused-geo':'fake'});
 assert.deepEqual(geoFromHeaders(headers,'none'),{});
 assert.deepEqual(geoFromHeaders(headers,'vercel'),{country:'ES',region:undefined,city:'Madrid'});
 assert.deepEqual(geoFromHeaders(new Headers({'cf-ipcountry':'XX'}),'cloudflare'),{country:undefined,region:undefined,city:undefined});
});
