import { describe, expect, it } from 'vitest';
import { buildShelterQuery, parseShelters } from './overpass';

describe('buildShelterQuery', () => {
  it('queries all four shelter tag schemes together in one union', () => {
    const query = buildShelterQuery({ minLon: 120.5, minLat: 15.1, maxLon: 120.7, maxLat: 15.2 });
    expect(query).toContain('nwr["amenity"="shelter"]');
    expect(query).toContain('nwr["social_facility"="shelter"]');
    expect(query).toContain('nwr["emergency"="assembly_point"]');
    expect(query).toContain('nwr["evacuation_center"="yes"]');
    expect(query).toContain('15.1,120.5,15.2,120.7');
    expect(query).toContain('out center tags');
  });
});

describe('parseShelters', () => {
  it('reads nodes and way centers, records the matched tag', () => {
    const shelters = parseShelters({
      elements: [
        { type: 'node', id: 1, lat: 15.1, lon: 120.5, tags: { name: 'Gym', amenity: 'shelter' } },
        { type: 'way', id: 2, center: { lat: 15.2, lon: 120.6 }, tags: { emergency: 'assembly_point' } },
        { type: 'relation', id: 3, center: { lat: 15.3, lon: 120.7 }, tags: { evacuation_center: 'yes' } },
      ],
    });
    expect(shelters).toHaveLength(3);
    expect(shelters[0]).toEqual({ id: 'node/1', lon: 120.5, lat: 15.1, name: 'Gym', matchedTag: 'amenity=shelter' });
    expect(shelters[1].name).toBeNull();
    expect(shelters[1].matchedTag).toBe('emergency=assembly_point');
    expect(shelters[2].matchedTag).toBe('evacuation_center=yes');
  });

  it('drops elements without coordinates or shelter tags', () => {
    const shelters = parseShelters({
      elements: [
        { type: 'node', id: 1, tags: { name: 'Nowhere' } },
        { type: 'node', id: 2, lat: 15.1, lon: 120.5, tags: { amenity: 'school' } },
        { type: 'node', id: 3, lat: 15.1, lon: 120.5, tags: { social_facility: 'shelter' } },
      ],
    });
    expect(shelters).toHaveLength(1);
    expect(shelters[0].id).toBe('node/3');
  });
});
