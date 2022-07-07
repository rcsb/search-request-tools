# search-request-tools
npm module containing shared components for search

## Installation
```sh
npm i @rcsb/search-request-tools
```
## Usage
### Javascript

```javascript
import searchRequestTools from '@rcsb/search-request-tools'
/* OR */
const searchRequestTools = require('@rcsb/search-request-tools')
```
#### addRefinement(request, node)
Add a single refinement node to an existing Search API request object. The request.query may be of type 'terminal' or 'group'.
The node to be added may be of type 'terminal' or 'group' but the 'group' type should only be used for 'nested' attribute pairs.
This function is called primarily from the 'groups' landing page. Examples:

##### Add a terminal node for a single attribute:

```javascript
const searchRequestTools = require('@rcsb/search-request-tools');
const request = { ... } // existing Search API request object
const node = {
        "type": "terminal",
        "service": "text",
        "parameters": {
            "attribute": "exptl.method",
            "operator": "exact_match",
            "value": "ELECTRON MICROSCOPY"
        }
    }

searchRequestTools.addRefinement(request, node)
```
##### Add a group node for a single nested attribute pair:
For nested attribute pairs, the number and order of the nodes in the group is important. The nested attribute must be the second of 2 terminal nodes.

```javascript
const request = { ... } // existing Search API request object
const node = {
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

searchRequestTools.addRefinement(request, node)
```

#### Add multiple refinements:

Add multiple refinements to an existing Search API request object. This function is called primarily to handle one or more selections made in the Search UI Refinement panel.

```javascript
const request = { ... } // existing Search API request object
const refinements = [
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

searchRequestTools.addRefinements(request, refinements)
```

