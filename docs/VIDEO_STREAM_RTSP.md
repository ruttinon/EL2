# Video Widget — RTSP Bridge

The Graphics **Video** widget plays browser-friendly streams only. Browsers cannot play raw `rtsp://` URLs directly. Use a small gateway on the plant network to republish RTSP as **MJPEG** or **HLS**, then paste the HTTP URL into the widget.

## Architecture

```
IP Camera (RTSP)  →  MediaMTX / ffmpeg  →  MJPEG or HLS (HTTP)  →  Video widget
```

## Option A — MediaMTX (recommended)

1. Install [MediaMTX](https://github.com/bluenviron/mediamtx).
2. Add your camera as a path, e.g. `rtsp://user:pass@192.168.1.50/stream1`.
3. Enable HLS or MJPEG output (defaults expose HTTP on port `8888` / `8889` depending on build).
4. In the Editor, set Video object **Stream type** to `hls` or `mjpeg` and URL, for example:
   - HLS: `http://192.168.1.10:8888/cam1/index.m3u8`
   - MJPEG: `http://192.168.1.10:8889/cam1`

## Option B — ffmpeg one-liner (MJPEG)

```bash
ffmpeg -rtsp_transport tcp -i "rtsp://user:pass@192.168.1.50/stream1" \
  -f mjpeg -q:v 5 -r 10 -listen 1 "http://0.0.0.0:8090/cam.mjpg"
```

Widget URL: `http://server:8090/cam.mjpg` · Stream type: **mjpeg**

## Option C — ffmpeg HLS

```bash
ffmpeg -rtsp_transport tcp -i "rtsp://user:pass@192.168.1.50/stream1" \
  -c:v copy -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments \
  /var/www/hls/cam/index.m3u8
```

Serve `/var/www/hls` with nginx or MediaMTX. Widget URL: `http://server/hls/cam/index.m3u8` · type: **hls**

## Option D — EnergyLink Engine RTSP bridge (ffmpeg on PATH)

When the Engine host has `ffmpeg` installed:

1. Set Video widget **Stream type** to `RTSP (Engine bridge)`.
2. Paste the camera URL, e.g. `rtsp://user:pass@192.168.1.50/stream1`.
3. Runtime calls `POST /api/stream/rtsp/start` and displays the returned MJPEG URL.

Manual API:

```http
POST /api/stream/rtsp/start
{ "rtspUrl": "rtsp://user:pass@192.168.1.50/stream1" }

→ { "ok": true, "id": "abc123", "mjpegUrl": "/api/stream/rtsp/abc123/mjpg" }
```

Stream URL for widgets: `http://engine:8081/api/stream/rtsp/{id}/mjpg` · type: **mjpeg** or **rtsp**

Stop: `DELETE /api/stream/rtsp/{id}` · List: `GET /api/stream/rtsp`

### HLS output (same session)

```http
POST /api/stream/rtsp/start
→ { "ok": true, "id": "abc123", "mjpegUrl": "...", "hlsUrl": "/api/stream/rtsp/abc123/hls/index.m3u8" }
```

Playlist: `GET /api/stream/rtsp/{id}/hls/index.m3u8` · Segments: `GET /api/stream/rtsp/{id}/hls/seg_000.ts`

Video widget stream type **RTSP** prefers HLS automatically; use **HLS** type with the `hlsUrl` for manual URLs.

Check tools: `GET /api/stream/tools`

## Security notes

- Prefer read-only camera credentials on the gateway host.
- Use HTTPS or VPN for remote operators; do not expose unauthenticated MJPEG to the public internet.
- Latency: MJPEG ~0.5–2 s; HLS typically 4–10 s segment delay.

## EnergyLink widget settings

| Property | Value |
|----------|--------|
| `style.videoStreamType` | `file` \| `mjpeg` \| `hls` |
| `style.videoUrl` or `text` | HTTP(S) URL to stream |
| `style.videoPoster` | Optional poster image |

File/GLB assets for 3D remain separate — see [ASSET_CONVERT_PIPELINE.md](./ASSET_CONVERT_PIPELINE.md).
