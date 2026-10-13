import { describe, expect, it } from "vitest";
import {
  nearestCameras,
  parseQuebecCameras,
  parseUsgsCameras,
  usgsImageUrl,
} from "../src/lib/cameras";

const usgsPayload = [
  {
    camId: "IL_Lick_Creek_near_Woodside",
    camName: "Lick Creek near Woodside",
    lat: "39.71553889",
    lng: "-89.7024444",
    stateAbrv: "IL",
    hideCam: false,
    newestImageDT: "2026-10-13T04:30:03.000Z",
    smallDir: "https://usgs-nims-images.s3.amazonaws.com/720/IL_Lick_Creek_near_Woodside/",
  },
  {
    camId: "Hidden_Cam",
    camName: "Hidden",
    lat: "39.72",
    lng: "-89.70",
    hideCam: true,
    smallDir: "https://usgs-nims-images.s3.amazonaws.com/720/Hidden_Cam/",
  },
  {
    camId: "bad id",
    camName: "Bad",
    lat: "39.7",
    lng: "-89.7",
    smallDir: "https://example.com/not-usgs/",
  },
];

const quebecPayload = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-71.208, 46.813] },
      properties: {
        IDEcamera: "1001",
        DescriptionLocalisationEn: "Route 175 at Quebec",
        URL_FLUX_DONNEE: "https://www.quebec511.info/Carte/Fenetres/FenetreVideo.html?id=1001",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-73.6, 45.5] },
      properties: {
        IDEcamera: "9",
        DescriptionLocalisationEn: "Off-host camera",
        URL_FLUX_DONNEE: "https://example.com/stream.mp4",
      },
    },
  ],
};

describe("public cameras", () => {
  it("keeps USGS stills on the official image host and drops hidden cameras", () => {
    const cameras = parseUsgsCameras(usgsPayload);
    expect(cameras).toHaveLength(2);
    expect(cameras[0]).toMatchObject({
      id: "usgs-IL_Lick_Creek_near_Woodside",
      source: "usgs-hivis",
      imageUrl:
        "https://usgs-nims-images.s3.amazonaws.com/720/IL_Lick_Creek_near_Woodside/IL_Lick_Creek_near_Woodside_newest.jpg",
    });
    expect(cameras[1].imageUrl).toBeNull();
    expect(usgsImageUrl("IL_Lick_Creek_near_Woodside", "https://evil.example/720/")).toBeNull();
  });

  it("keeps Québec viewer links and does not attach a still", () => {
    const cameras = parseQuebecCameras(quebecPayload);
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({
      id: "qc-1001",
      source: "quebec-511",
      imageUrl: null,
      pageUrl: "https://www.quebec511.info/Carte/Fenetres/FenetreVideo.html?id=1001",
    });
  });

  it("returns the nearest cameras inside 50 km", () => {
    const usgs = parseUsgsCameras(usgsPayload);
    const quebec = parseQuebecCameras(quebecPayload);
    const near = nearestCameras({ usgs, quebec }, { lat: 39.72, lon: -89.7 });
    expect(near.map((camera) => camera.id)).toEqual([
      "usgs-IL_Lick_Creek_near_Woodside",
      "usgs-bad id",
    ]);
    expect(near[0].km).toBeLessThan(1);
    const far = nearestCameras({ usgs, quebec }, { lat: 46.813, lon: -71.208 });
    expect(far.map((camera) => camera.id)).toEqual(["qc-1001"]);
    expect(nearestCameras({ usgs, quebec }, { lat: 0, lon: 0 })).toEqual([]);
  });
});
