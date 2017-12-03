{
  class Description {

    constructor(type, key, template) {
      this.type = type;
      this.key = key;
      Object.defineProperty(this, 'template', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: template,
      });
    }

    isCompatible(desc) {
      return desc && desc.type === this.type;
    }

    isComponent() {
      return this instanceof ComponentDescription;
    }

    isElement() {
      return this instanceof ElementDescription;
    }
  }

  class ComponentDescription extends Description {

    constructor({symbol, props, children}, template) {
      super(opr.Toolkit.Component.NodeType, props && props.key, template);
      this.symbol = symbol;
      if (props) {
        this.props = props;
      }
      if (children) {
        this.children = children;
      }
    }

    isCompatible(desc) {
      return super.isCompatible(desc) && desc.component === this.component;
    }
  }

  /*
   * Defines a normalized description of an element. Is used to determine the
   * differences between compatible elements (with the same tag name).
   *
   * Enumerable properties:
   * - name (a string representing tag name),
   * - text (a string representing text content),
   * - children (an array of child nodes),
   * - props (an object) defining:
   *    - listeners (an object for event name to listener mapping)
   *    - attrs (an object for normalized attribute name to value mapping)
   *    - dataset (an object representing data attributes)
   *    - classNames (an array of sorted class names)
   *    - style (an object for style property to string value mapping)
   *    - metadata (an object for properties set directly on DOM element)
   *
   * Non-enumerable properties:
   * - template: a reference to the source template.
   */
  class ElementDescription extends Description {

    constructor({name, text = null, children, props}, template) {
      super(opr.Toolkit.VirtualElement.NodeType, props && props.key, template);

      this.name = name;
      this.text = text;

      const {
        SUPPORTED_ATTRIBUTES,
        SUPPORTED_EVENTS,
        SUPPORTED_STYLES,
        Template,
      } = opr.Toolkit;

      if (children && children.length > 0) {
        this.children = children;
      }

      if (props) {

        if (opr.Toolkit.isDebug()) {
          const unknownAttrs = Object.keys(props).filter(
              attr => !opr.Toolkit.utils.isSupportedAttribute(attr));
          for (const unknownAttr of unknownAttrs) {
            const suggestion = SUPPORTED_ATTRIBUTES.find(
                attr => attr.toLowerCase() === unknownAttr.toLowerCase());
            if (suggestion) {
              opr.Toolkit.warn(
                  `Attribute name "${
                                     unknownAttr
                                   }" should be spelled "${suggestion}"`);
            } else {
              opr.Toolkit.warn(`Attribute name "${unknownAttr}" is not valid,`);
            }
          }
        }

        const normalized = {};

        const keys = Object.keys(props);

        // listeners
        const listeners = {};
        const events = keys.filter(key => SUPPORTED_EVENTS.includes(key));
        for (const event of events) {
          const listener = props[event];
          if (typeof listener === 'function') {
            listeners[event] = listener;
          }
        }
        if (Object.keys(listeners).length) {
          normalized.listeners = listeners;
        }

        // attributes
        const attrs = {};
        const attrNames =
            keys.filter(key => SUPPORTED_ATTRIBUTES.includes(key));
        for (const attr of attrNames) {
          const value = Template.getAttributeValue(props[attr]);
          if (value !== null && value !== undefined) {
            attrs[attr] = value;
          }
        }
        if (Object.keys(attrs).length) {
          normalized.attrs = attrs;
        }

        // data attributes
        if (props.dataset) {
          const dataset = {};
          for (const key of Object.keys(props.dataset)) {
            const value = Template.getAttributeValue(props.dataset[key]);
            if (value !== null && value !== undefined) {
              dataset[key] = String(value);
            }
          }
          if (Object.keys(dataset).length) {
            normalized.dataset = dataset;
          }
        }

        // class names
        if (props.class) {
          const className = Template.getClassName(props.class);
          if (className.length) {
            normalized.className = className;
          }
        }

        // style
        if (props.style) {
          const style = {};
          const keys = Object.keys(props.style)
                           .filter(key => SUPPORTED_STYLES.includes(key));
          for (const key of keys) {
            const value = Template.getStyleValue(props.style[key], key);
            if (value !== null && value !== undefined) {
              style[key] = value;
            }
          }
          if (Object.keys(style).length) {
            normalized.style = style;
          }
        }

        // metadata
        if (props.metadata) {
          const metadata = {};
          for (const key of Object.keys(props.metadata)) {
            metadata[key] = props.metadata[key];
          }
          if (Object.keys(metadata).length) {
            normalized.metadata = metadata;
          }
        }

        if (Object.keys(normalized).length) {
          this.props = normalized;
        }
      }
    }

    isCompatible(desc) {
      return super.isCompatible(desc) && desc.name === this.name;
    }
  }

  class Template {

    static getClassName(value) {
      if (!value) {
        return '';
      }
      if (typeof value === 'string') {
        return value;
      }
      if (Array.isArray(value)) {
        return value
            .reduce(
                (result, item) => {
                  if (!item) {
                    return result;
                  }
                  if (typeof item === 'string') {
                    result.push(item);
                    return result;
                  }
                  result.push(this.getClassName(item));
                  return result;
                },
                [])
            .filter(item => item)
            .join(' ');
      }
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) {
          return [];
        }
        return Object.keys(value)
            .map(key => value[key] && key)
            .filter(item => item)
            .join(' ');
      }
      return '';
    }

    static getCompositeValue(obj = {}, whitelist) {
      const names = Object.keys(obj).filter(name => whitelist.includes(name));
      return this.getAttributeValue(names.reduce((result, name) => {
        const value = this.getAttributeValue(obj[name], false);
        if (value) {
          result[name] = value;
        }
        return result;
      }, {}));
    }

    static getAttributeValue(value, allowEmptyString = true) {
      if (value === undefined || value === null) {
        return null;
      }
      if (value.constructor === Function) {
        return null;
      }
      if (value.constructor === Array) {
        return value.length > 0 ? value.join('') : null;
      }
      if (value.constructor === Object) {
        const entries = Object.entries(value);
        if (entries.length > 0) {
          return entries.map(([name, value]) => `${name}(${value})`).join(' ');
        }
        return null;
      }
      if (value === '') {
        return allowEmptyString ? '' : null;
      }
      return String(value);
    }

    static getStyleValue(value, prop = null) {
      switch (prop) {
        case 'filter':
          return this.getCompositeValue(value, opr.Toolkit.SUPPORTED_FILTERS);
        case 'transform':
          return this.getCompositeValue(
              value, opr.Toolkit.SUPPORTED_TRANSFORMS);
        default:
          return this.getAttributeValue(value);
      }
    }

    static get ItemType() {
      return {
        STRING: 'string',
        NUMBER: 'number',
        BOOLEAN: 'boolean',
        UNDEFINED: 'undefined',
        NULL: 'null',
        COMPONENT: 'component',
        ELEMENT: 'element',
        PROPS: 'props',
        FUNCTION: 'function',
      };
    }

    static getItemType(item) {

      const Type = Template.ItemType;
      const type = typeof item;

      switch (type) {
        case 'string':
          return Type.STRING;
        case 'number':
          return Type.NUMBER;
        case 'boolean':
          return Type.BOOLEAN;
        case 'undefined':
          return Type.UNDEFINED;
        case 'symbol':
          return Type.SYMBOL;
        case 'function':
          if (type.prototype instanceof opr.Toolkit.Component) {
            return Type.COMPONENT;
          }
          return Type.RENDERER;
        case 'object':
          if (item === null) {
            return Type.NULL;
          } else if (Array.isArray(item)) {
            return Type.ELEMENT;
          }
          return Type.PROPS;
      }
    }

    static validate(template) {

      const validParamTypes =
          'properties object, text content or first child element';

      const createErrorDescription = (val, i, types) =>
          `Invalid parameter type "${val}" at index ${i}, expecting: ${types}`;

      if (template === null || template === false) {
        return {types: null};
      }

      if (!Array.isArray(template)) {
        const error =
            new Error(`Specified template: "${template}" is not an array!`);
        console.error('Specified template', template, 'is not an array!');
        return {error};
      }

      const Type = Template.ItemType;
      const types = template.map(this.getItemType);

      if (![Type.STRING, Type.COMPONENT].includes(types[0])) {
        console.error(
            'Invalid element:', template[0],
            ', expecting component or tag name');
        const error =
            new Error(`Invalid parameter type "${types[0]}" at index 0`);
        return {error, types};
      }

      if (types.length <= 1) {
        return {types};
      }

      let firstChildIndex = 1;

      switch (types[1]) {
        case Type.STRING:
          if (types.length > 2) {
            const error = new Error('Text elements cannot have child nodes');
            console.error(
                'Text elements cannot have child nodes:', template.slice(1));
            return {
              error,
              types,
            };
          } else if (types[0] === Type.COMPONENT) {
            const error = new Error('Subcomponents do not accept text content');
            console.error(
                'Subcomponents do not accept text content:', template[1]);
            return {
              error,
              types,
            };
          }
        case Type.PROPS:
          firstChildIndex = 2;
        case Type.NULL:
        case Type.BOOLEAN:
          if (template[1] === true) {
            const error =
                new Error(createErrorDescription(types[1], 1, validParamTypes));
            console.error(
                'Invalid parameter', template[1],
                ', expecting:', validParamTypes);
            return {
              error,
              types,
            };
          }
        case Type.ELEMENT:
          if (types.length > 2) {
            if (types[2] === Type.STRING) {
              if (types.length > 3) {
                const error =
                    new Error('Text elements cannot have child nodes');
                console.error(
                    'Text elements cannot have child nodes:',
                    template.slice(2));
                return {
                  error,
                  types,
                };
              } else if (types[0] === Type.COMPONENT) {
                const error =
                    new Error('Subcomponents do not accept text content');
                console.error(
                    'Subcomponents do not accept text content:', template[2]);
                return {
                  error,
                  types,
                };
              }
              return {
                types,
              };
            }
          }
          for (let i = firstChildIndex; i < template.length; i++) {
            const expected = i === 1 ? validParamTypes : 'child element';
            if (types[i] !== Type.ELEMENT && template[i] !== null &&
                template[i] !== false) {
              const error = new Error(
                  `Invalid parameter type "${types[i]}" at index ${i}`);
              console.error(
                  'Invalid parameter:', template[i], ', expecting:', expected);
              return {
                error,
                types,
              };
            }
          }
          return {
            types,
          };
      }
      const error =
          new Error(createErrorDescription(types[1], 1, validParamTypes));
      console.error(
          'Invalid parameter', template[1], ', expecting:', validParamTypes);
      return {
        error,
        types,
      };
    }

    static describe(template) {

      if (template === false || template === null) {
        return null;
      }

      if (Array.isArray(template) && template.length > 0) {

        const Type = this.ItemType;
        const details = {};

        const getParams = item => {
          const type = typeof item;
          switch (type) {
            case 'string':
              return ['element', 'name', item];
            case 'symbol':
              return ['component', 'symbol', String(item).slice(7, -1)];
            case 'function':
              if (item.prototype instanceof opr.Toolkit.Component) {
                return ['component', 'component', item];
              } else {
                return ['component', 'renderer', item];
              }
            default:
              throw new Error('Invalid type:' + item);
          }
        };
        const isProps = item =>
            item && !Array.isArray(item) && typeof item === 'object';

        const [type, name, value] = getParams(template[0]);

        details.type = type;
        details[name] = value;

        let index = 1;
        if (template.length > 1 && isProps(template[1])) {
          details.props = template[1];
          index = 2;
        }

        for (let i = index; i < template.length; i++) {
          const item = template[i];
          if (item !== null && item !== false) {
            if (Array.isArray(item)) {
              if (details.children) {
                details.children.push(item);
              } else {
                details.children = [item];
              }
            } else if (typeof item === 'string') {
              details.text = item;
            } else {
              throw new Error('Invalid item!');
            }
          }
        }
        return this.normalize(details, template);
      }
      throw new Error('Invalid template!');
    }

    static normalize(details, template = null) {
      return details.type === 'element' ?
          new ElementDescription(details, template) :
          new ComponentDescription(details, template);
    }
  }

  Template.Description = Description;

  module.exports = Template;
}
