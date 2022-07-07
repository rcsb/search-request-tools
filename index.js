/*
    cd ./search-request
    npm publish
*/

/*
 * Module exports.
 * @public
 */
 module.exports = {
    addRefinement
  , addRefinements
}

const LOG_PREFIX = 'RO-3185 search-request'
    , GROUP = 'group'
    , TERMINAL = 'terminal'
    , AND = 'and'
    , OR = 'or'
    , EXACT_MATCH = 'exact_match'
    , LESS = 'less'
    , GREATER_OR_EQUAL = 'greater_or_equal'
    , RANGE = 'range'
    , LABEL_GROUPS_REFINEMENTS = 'groups-refinements'
    , LABEL_NESTED_ATTRIBUTE = 'nested-attribute'

/*
 * Add a refinement node to an existing Search API request. The refinement node will be added to an existing
 * LABEL_GROUPS_REFINEMENTS node. If no LABEL_GROUPS_REFINEMENTS node is found, a new one will be created. The
 * refinement node will NOT be added if a matching attribute/value pair is found.
 *
 * The input 'request' parameter query can be either of type 'terminal' or type 'group'. If it is of type 'terminal'
 * the terminal node will be wrapped in an inner and outer group node.
 *
 * The input 'node' parameter can be either of type 'terminal' or type 'group'. If it is a 'group' node it must
 * contain 2 terminal nodes, the second of which must be the nested attribute corresponding to the attribute
 * of the first node.
 *
 * @param {object} request
 * @param {object} node
 * @param {string} schema
 * @param {string} service
 * @public
 *
 * Example 'node' parameters:
 *
 *  terminal node:
        {
            "type": "terminal",
            "service": "text",
            "parameters": {
                "attribute": "exptl.method",
                "operator": "exact_match",
                "value": "ELECTRON MICROSCOPY"
            }
        }

 *  group node:
        {
            "type": "group",
            "nodes": [
                {
                    "type": "terminal",
                    "service": "text",
                    "parameters": {
                        "attribute": "rcsb_polymer_instance_annotation.annotation_lineage.id",
                        "operator": "exact_match",
                        "value": "2"
                    }
                },
                {
                    "type": "terminal",
                    "service": "text",
                    "parameters": {
                        "attribute": "rcsb_polymer_instance_annotation.type",
                        "operator": "exact_match",
                        "value": "CATH"
                    }
                }
            ],
            "logical_operator": "and"
        }
*/
function addRefinement (request, node, schema = 'structure', service = 'text') {
    let serviceNode, refinementNode, attributeNode

    if (request.query.type === 'terminal') { // outer node is of type 'terminal'
        const terminalNode = request.query // extract the terminalNode from the request
        request.query = getEmptyGroupNode(null, AND) // reset request.query to be a group node
        serviceNode = getGroupNode(request.query, service, AND) // add the serviceNode to request.query

        const innerGroupNode = getEmptyGroupNode(null, AND) // create innerGroupNode
        innerGroupNode.nodes.push(terminalNode) // add terminalNode to innerGroupNode
        serviceNode.nodes.push(innerGroupNode)  // add innerGroupNode to serviceNode
    } else {
        serviceNode = getGroupNode(request.query, service, AND)
    }

    refinementNode = getGroupNode(serviceNode, LABEL_GROUPS_REFINEMENTS, AND) // add refinementNode to serviceNode

    if (node.type === TERMINAL) {
        const { attribute, value } = node.parameters

        attributeNode = getGroupNode(refinementNode, attribute, OR)

        let found = false
        attributeNode.nodes.forEach(n => { if (n.parameters.value === value) found = true })

        if (!found) attributeNode.nodes.push(node) // only add if not found - avoids multiple identical nodes
    } else { // group
        const { attribute, value } = node.nodes[0].parameters

        attributeNode = getGroupNode(refinementNode, attribute, OR)

        let found = false
        attributeNode.nodes.forEach(n => { if (n.nodes[0].parameters.value === value) found = true })

        if (!found) {
            const attrObj = metadata[schema].uiAttrMap[attribute]
                , nested_attribute = node.nodes[1].parameters.attribute

            if (attrObj && attrObj.nestedAttribute && attrObj.nestedAttribute.attribute === nested_attribute) node.label = LABEL_NESTED_ATTRIBUTE

            attributeNode.nodes.push(node)
        }
    }
}

/*
* Add a refinements node to an existing Search API request. Each call to this function will append a new
* refinement node to the existing request. The 'refinements' input parameter is typically derived from
* user selections in the Search UI Refinement Panel.
*
* Refinements are passed to the function in this format:

    refinements=[
        {
            attribute: "rcsb_entity_source_organism.ncbi_scientific_name",
            values: [
                "Homo sapiens",
                "Human immunodeficiency virus"
            ]
        },
        {
            attribute: "rcsb_entry_info.resolution_combined",
            values: [
                "*-0.5",
                "0.5-1.0"
            ]
        }
    ]

    and are converted to the Search API request format:

        {
            "type": "terminal",
            "service": "text",
            "parameters": {
                "attribute": "rcsb_entry_info.resolution_combined",
                "value": 0.5,
                "operator": "less"
            }
        },
        {
            "type": "terminal",
            "service": "text",
            "parameters": {
                "attribute": "rcsb_entry_info.resolution_combined",
                "operator": "range",
                "value": {
                    "from": 1,
                    "to": 1.5,
                    "include_lower": true,
                    "include_upper": false
                }
            }
        }
*
* @param {object} request
* @param {object} refinements
* @param {string} schema
* @param {string} service
* @public
*/
function addRefinements (request, refinements, result_type = 'entry') {
    const { query } = request
        , schema = (result_type === 'mol_definition') ? 'chemical' : 'structure'
        , service = (result_type === 'mol_definition') ? 'text_chem' : 'text'

    //log(result_type, 'result_type')
    //log(service, 'service')

    let serviceNode, refinementNode, attributeNode

    serviceNode = getGroupNode(query, service, AND)

    /*
        note:   calls to this function will always append a new 'refinement' node to the request, so
                getEmptyGroupNode() is called rather than getGroupNode()
    */
    refinementNode = getEmptyGroupNode(null, AND)
    serviceNode.nodes.push(refinementNode)

    refinements.forEach(refinement => {
        const { attribute } = refinement

        attributeNode = getGroupNode(refinementNode, attribute, OR)

        if (metadata[schema].facetFilters[attribute]) setFacetFilterAttributeNode(schema, service, attributeNode, refinement)
        else setAttributeNode(service, attributeNode, refinement)
    })
}

// private functions

// return an empty group node
function getEmptyGroupNode(label, logical_operator) {
    const node = {
          type: GROUP
        , nodes: []
        , logical_operator }

    if (label) node.label = label

    return node
}

/*
    Return a group node by label. If no matching node is found, a new one is created and returned.
    Additionally, the returned node is added to the input node.nodes array
*/
function getGroupNode(node, label, operator = AND) {
    const { type, nodes } = node

    let groupNode

    if (type === GROUP) {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].label === label) groupNode = nodes[i]
        }

        if (!groupNode) {
            groupNode = getEmptyGroupNode(label, operator)
            node.nodes.push(groupNode)
        }
    }
    return groupNode
}

// return a terminal node
function getTerminalNode(service, parameters) {
    return {
          type: TERMINAL
        , service
        , parameters
    }
}

/*
* Add refinement to the Search API request.
*
* @param {string} service
* @param {object} attributeNode
* @param {object} refinement
* @private
*/
function setAttributeNode(service, attributeNode, refinement) {
    const { attribute, values } = refinement

    let operator

    values.forEach(value => {
        if (    attribute === 'rcsb_entry_info.resolution_combined' ||
                attribute === 'chem_comp.formula_weight' ||
                attribute === 'rcsb_chem_comp_info.atom_count_heavy' ) { // numeric - operator may be range, less, greater_or_equal

            const arr = value.split('-')

            if (value.indexOf('*') === 0) {
                operator = LESS
                value = parseFloat(arr[1])
            } else if (value.indexOf('-*') !== -1) {
                operator = GREATER_OR_EQUAL
                value = parseFloat(arr[0])
            } else {
                operator = RANGE
                value = {
                        from: parseFloat(arr[0])
                    , to: parseFloat(arr[1])
                    , include_lower: true
                    , include_upper: false
                }
            }
        } else if ( attribute === 'rcsb_accession_info.initial_release_date' ||
                    attribute === 'rcsb_chem_comp_info.initial_release_date' ) {

            operator = 'range'
            value = {
                    from: value + '-01-01'
                , to: (parseInt(value) + 4) + '-12-31'
                , include_lower: true
                , include_upper: true
            }
        } else {
            operator = EXACT_MATCH
        }

        const parameters = { attribute, value, operator }
        attributeNode.nodes.push(getTerminalNode(service, parameters))
    })

    //log(attributeNode, 'setAttributeNode: attributeNode')
}

/*
 * Return a group node representing a refinement that has a facetFilter.
 *
 * @param {string} schema
 * @param {string} service
 * @param {object} attributeNode
 * @param {object} refinement
 * @private
 */
function setFacetFilterAttributeNode(schema, service, attributeNode, refinement) {
    const { attribute, values } = refinement
        , { uiAttrMap, facetFilters } = metadata[schema]
        , attrObj = uiAttrMap[attribute]
        , facetFilter = facetFilters[attribute]
        , operator = EXACT_MATCH

    //log(attrObj, 'setFacetFilterAttributeNode: attrObj')
    //log(facetFilter, 'setFacetFilterAttributeNode: facetFilter')

    // if (attrObj && attrObj.nestedAttribute && attrObj.nestedAttribute.attribute === facetFilter.parameters.attribute) {
    //     log(attrObj.nestedAttribute, 'setFacetFilterAttributeNode: attrObj.nestedAttribute')
    // }

    values.forEach(value => {
        const groupNode = getEmptyGroupNode(null, AND)
            , parameters = { attribute, value, operator }

        groupNode.nodes.push(getTerminalNode(service, parameters))
        groupNode.nodes.push(facetFilter)

        if (attrObj && attrObj.nestedAttribute && attrObj.nestedAttribute.attribute === facetFilter.parameters.attribute) groupNode.label = LABEL_NESTED_ATTRIBUTE

        attributeNode.nodes.push(groupNode)
    })

    //log(attributeNode, 'setFacetFilterAttributeNode: attributeNode AFTER TRANSFORM')
}

// utils

function logErr(o, name) {
    log(o, name, true)
}

function log(o, name, err) {
    const type = typeof o
    if (!name) name = type
    const output = (type === 'object') ? JSON.stringify(o, null, 2) : o

    if (err) console.error(LOG_PREFIX + ': ' + name + '=' + output)
    else console.log(LOG_PREFIX + ': ' + name + '=' + output)
}

