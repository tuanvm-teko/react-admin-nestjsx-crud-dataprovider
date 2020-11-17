import { RequestQueryBuilder, CondOperator } from "@nestjsx/crud-request";
import {
  fetchUtils,
  GET_LIST,
  GET_ONE,
  GET_MANY,
  GET_MANY_REFERENCE,
  CREATE,
  UPDATE,
  UPDATE_MANY,
  DELETE,
  DELETE_MANY,
} from "react-admin";

export default (apiUrl: string, httpClient = fetchUtils.fetchJson) => {
  const composeFilter = (paramsFilter: any) => {
    if (
      paramsFilter === "" ||
      (typeof paramsFilter.q !== "undefined" && paramsFilter.q === "")
    ) {
      paramsFilter = {};
    }

    const flatFilter = fetchUtils.flattenObject(paramsFilter);
    const filter = Object.keys(flatFilter).map((key) => {
      const splitKey = key.split("||");
      const ops = splitKey[1] ? splitKey[1] : "cont";
      let field = splitKey[0];

      if (field.indexOf("_") === 0 && field.indexOf(".") > -1) {
        field = field.split(/\.(.+)/)[1];
      }
      return { field, operator: ops, value: flatFilter[key] };
    });
    return filter;
  };
  const convertDataRequestToHTTP = (
    type: string,
    resource: string,
    params: any
  ) => {
    let url = "";
    const options: any = {};
    switch (type) {
      case GET_LIST: {
        const { page, perPage } = params.pagination;

        const query = RequestQueryBuilder.create(
          !!params.filter["0"]
            ? {
                or: composeFilter(params.filter[0]) as any,
              }
            : {
                filter: composeFilter(params.filter) as any,
              }
        )
          .setLimit(perPage)
          .setPage(page)
          .sortBy(params.sort)
          .setOffset((page - 1) * perPage)
          .query();

        url = `${apiUrl}/${resource}?${query}`;

        break;
      }
      case GET_ONE: {
        url = `${apiUrl}/${resource}/${params.id}`;

        break;
      }
      case GET_MANY: {
        const query = RequestQueryBuilder.create()
          .setFilter({
            field: "id",
            operator: CondOperator.IN,
            value: `${params.ids}`,
          })
          .query();

        url = `${apiUrl}/${resource}?${query}`;

        break;
      }
      case GET_MANY_REFERENCE: {
        const { page, perPage } = params.pagination;
        const filter = composeFilter(params.filter) as any;

        filter.push({
          field: params.target,
          operator: CondOperator.EQUALS,
          value: params.id,
        });

        const query = RequestQueryBuilder.create({
          filter,
        })
          .sortBy(params.sort)
          .setLimit(perPage)
          .setOffset((page - 1) * perPage)
          .query();

        url = `${apiUrl}/${resource}?${query}`;

        break;
      }
      case UPDATE: {
        url = `${apiUrl}/${resource}/${params.id}`;
        options.method = "PATCH";
        options.body = JSON.stringify(params.data);
        break;
      }
      case CREATE: {
        options.method = "POST";

        if (Array.isArray(params.data)) {
          url = `${apiUrl}/${resource}/bulk`;
          options.body = JSON.stringify({ bulk: params.data });
          break;
        }
        url = `${apiUrl}/${resource}`;
        options.body = JSON.stringify(params.data);
        break;
      }
      case DELETE: {
        url = `${apiUrl}/${resource}/${params.id}`;
        options.method = "DELETE";
        break;
      }
      default:
        throw new Error(`Unsupported fetch action type ${type}`);
    }
    return { url, options };
  };

  const convertHTTPResponse = (
    response: any,
    type: string,
    resource: string,
    params: any
  ) => {
    const { headers, json } = response;
    switch (type) {
      case GET_LIST:
      case GET_MANY_REFERENCE:
        return {
          data: json.data,
          total: json.total,
        };
      case CREATE:
        return { data: { ...params.data, id: json.id } };
      default:
        return { data: json };
    }
  };

  return (type: string, resource: string, params: any) => {
    if (type === UPDATE_MANY) {
      return Promise.all(
        params.ids.map((id) =>
          httpClient(`${apiUrl}/${resource}/${id}`, {
            method: "PUT",
            body: JSON.stringify(params.data),
          })
        )
      ).then((responses) => ({
        data: responses.map((response: any) => response.json),
      }));
    }
    if (type === DELETE_MANY) {
      return Promise.all(
        params.ids.map((id) =>
          httpClient(`${apiUrl}/${resource}/${id}`, {
            method: "DELETE",
          })
        )
      ).then((responses) => ({
        data: responses.map((response: any) => response.json),
      }));
    }

    const { url, options } = convertDataRequestToHTTP(type, resource, params);
    return httpClient(url, options).then((response) =>
      convertHTTPResponse(response, type, resource, params)
    );
  };
};
