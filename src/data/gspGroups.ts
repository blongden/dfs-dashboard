// Approximate centroids for GB GSP distribution groups.
// Used for placing BM action markers on the balancing context map.
export const GSP_CENTROIDS: Record<string, { name: string; lat: number; lng: number }> = {
  _A: { name: 'Eastern',             lat: 52.3,  lng:  0.8  },
  _B: { name: 'East Midlands',       lat: 52.9,  lng: -1.1  },
  _C: { name: 'London',              lat: 51.5,  lng: -0.12 },
  _D: { name: 'Merseyside & N Wales',lat: 53.3,  lng: -2.8  },
  _E: { name: 'Midlands',            lat: 52.5,  lng: -1.9  },
  _F: { name: 'Northern',            lat: 54.9,  lng: -1.6  },
  _G: { name: 'North Western',       lat: 53.8,  lng: -2.6  },
  _H: { name: 'Southern',            lat: 51.0,  lng: -1.0  },
  _J: { name: 'South Eastern',       lat: 51.2,  lng:  0.5  },
  _K: { name: 'South Wales',         lat: 51.7,  lng: -3.5  },
  _L: { name: 'South Western',       lat: 50.8,  lng: -3.8  },
  _M: { name: 'Yorkshire',           lat: 53.8,  lng: -1.5  },
  _N: { name: 'South Scotland',      lat: 55.9,  lng: -3.5  },
  _P: { name: 'North Scotland',      lat: 57.5,  lng: -4.0  },
}
