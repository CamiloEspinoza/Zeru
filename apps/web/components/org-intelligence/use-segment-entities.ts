"use client";

import { useReducer, useEffect } from "react";
import { api } from "@/lib/api-client";

export interface SegmentEntity {
  id: string;
  name: string;
  type: string;
  confidence: number;
  matchType: "text_match" | "extraction";
}

interface SegmentEntitiesData {
  segmentEntityMap: Map<number, SegmentEntity[]>;
  unlinkedEntities: SegmentEntity[];
  isLoading: boolean;
}

interface RawMapping {
  segmentIndex: number;
  entities: SegmentEntity[];
}

interface RawResponse {
  mappings: RawMapping[];
  unlinked: SegmentEntity[];
}

type State = {
  segmentEntityMap: Map<number, SegmentEntity[]>;
  unlinkedEntities: SegmentEntity[];
  isLoading: boolean;
};

type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; map: Map<number, SegmentEntity[]>; unlinked: SegmentEntity[] }
  | { type: "LOAD_ERROR" }
  | { type: "RESET" };

const initialState: State = {
  segmentEntityMap: new Map(),
  unlinkedEntities: [],
  isLoading: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, isLoading: true };
    case "LOAD_SUCCESS":
      return { segmentEntityMap: action.map, unlinkedEntities: action.unlinked, isLoading: false };
    case "LOAD_ERROR":
      return { ...initialState };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function useSegmentEntities(interviewId: string | null): SegmentEntitiesData {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!interviewId) {
      dispatch({ type: "RESET" });
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      dispatch({ type: "LOAD_START" });
      try {
        const data = await api.get<RawResponse>(
          `/org-intelligence/interviews/${interviewId}/segment-entities`,
        );
        if (cancelled) return;
        const map = new Map<number, SegmentEntity[]>();
        for (const { segmentIndex, entities } of data.mappings) {
          map.set(segmentIndex, entities);
        }
        dispatch({ type: "LOAD_SUCCESS", map, unlinked: data.unlinked ?? [] });
      } catch {
        if (!cancelled) dispatch({ type: "LOAD_ERROR" });
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  return state;
}
