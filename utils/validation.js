/**
 * 表单验证工具类
 */

module.exports = {
  /**
   * 验证手机号
   */
  validatePhone(phone) {
    if (!phone) {
      return { valid: false, message: '手机号不能为空' };
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return { valid: false, message: '请输入正确的手机号' };
    }

    return { valid: true };
  },

  /**
   * 验证邮箱
   */
  validateEmail(email) {
    if (!email) {
      return { valid: false, message: '邮箱不能为空' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: '请输入正确的邮箱地址' };
    }

    return { valid: true };
  },

  /**
   * 验证密码
   */
  validatePassword(password, minLength = 6, maxLength = 20) {
    if (!password) {
      return { valid: false, message: '密码不能为空' };
    }

    if (password.length < minLength) {
      return { valid: false, message: `密码长度不能少于${minLength}位` };
    }

    if (password.length > maxLength) {
      return { valid: false, message: `密码长度不能超过${maxLength}位` };
    }

    // 密码强度验证（可选）
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasLetter || !hasNumber) {
      return {
        valid: true,
        message: '建议包含字母和数字，提高密码安全性',
        strength: 'medium'
      };
    }

    if (hasSpecial) {
      return {
        valid: true,
        message: '密码强度良好',
        strength: 'strong'
      };
    }

    return {
      valid: true,
      message: '密码强度一般',
      strength: 'weak'
    };
  },

  /**
   * 验证用户名
   */
  validateUsername(username, minLength = 2, maxLength = 20) {
    if (!username) {
      return { valid: false, message: '用户名不能为空' };
    }

    if (username.length < minLength) {
      return { valid: false, message: `用户名长度不能少于${minLength}位` };
    }

    if (username.length > maxLength) {
      return { valid: false, message: `用户名长度不能超过${maxLength}位` };
    }

    // 验证用户名格式
    const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
    if (!usernameRegex.test(username)) {
      return { valid: false, message: '用户名只能包含字母、数字、下划线和中文' };
    }

    return { valid: true };
  },

  /**
   * 验证必填字段
   */
  validateRequired(value, fieldName = '该字段') {
    if (!value && value !== 0 && value !== false) {
      return { valid: false, message: `${fieldName}不能为空` };
    }
    return { valid: true };
  },

  /**
   * 验证数字范围
   */
  validateNumberRange(value, min, max, fieldName = '数值') {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return { valid: false, message: `${fieldName}必须是数字` };
    }

    if (min !== undefined && num < min) {
      return { valid: false, message: `${fieldName}不能小于${min}` };
    }

    if (max !== undefined && num > max) {
      return { valid: false, message: `${fieldName}不能大于${max}` };
    }

    return { valid: true };
  },

  /**
   * 验证字符串长度
   */
  validateStringLength(value, minLength, maxLength, fieldName = '内容') {
    if (!value) {
      return { valid: false, message: `${fieldName}不能为空` };
    }

    if (value.length < minLength) {
      return { valid: false, message: `${fieldName}长度不能少于${minLength}个字符` };
    }

    if (value.length > maxLength) {
      return { valid: false, message: `${fieldName}长度不能超过${maxLength}个字符` };
    }

    return { valid: true };
  },

  /**
   * 验证身份证号
   */
  validateIdCard(idCard) {
    if (!idCard) {
      return { valid: false, message: '身份证号不能为空' };
    }

    const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    if (!idCardRegex.test(idCard)) {
      return { valid: false, message: '请输入正确的身份证号' };
    }

    return { valid: true };
  },

  /**
   * 验证地址
   */
  validateAddress(address, minLength = 5, maxLength = 200) {
    if (!address) {
      return { valid: false, message: '地址不能为空' };
    }

    if (address.length < minLength) {
      return { valid: false, message: '地址信息太简单，请输入详细地址' };
    }

    if (address.length > maxLength) {
      return { valid: false, message: '地址信息过长' };
    }

    return { valid: true };
  },

  /**
   * 验证地址对象（微信地址格式）
   */
  validateAddressObject(address) {
    if (!address) {
      return { valid: false, message: '地址不能为空' };
    }

    if (!address.userName || !address.telNumber || !address.detailInfo) {
      return { valid: false, message: '地址信息不完整' };
    }

    // 验证手机号
    const phoneValidation = this.validatePhone(address.telNumber);
    if (!phoneValidation.valid) {
      return phoneValidation;
    }

    return { valid: true };
  },

  /**
   * 验证订单信息
   */
  validateOrderData(orderData) {
    const errors = [];

    // 验证商品列表
    if (!orderData.items || orderData.items.length === 0) {
      errors.push('订单商品不能为空');
    } else {
      orderData.items.forEach((item, index) => {
        if (!item.productId) {
          errors.push(`商品${index + 1}: 商品ID不能为空`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`商品${index + 1}: 数量必须大于0`);
        }
        if (!item.price || item.price <= 0) {
          errors.push(`商品${index + 1}: 价格必须大于0`);
        }
      });
    }

    // 验证订单金额
    if (!orderData.totalAmount || orderData.totalAmount <= 0) {
      errors.push('订单金额必须大于0');
    }

    // 验证配送信息
    if (orderData.deliveryType === 1) { // 配送
      if (!orderData.address) {
        errors.push('配送地址不能为空');
      }
      if (!orderData.contactName) {
        errors.push('联系人姓名不能为空');
      }
      if (!orderData.contactPhone) {
        errors.push('联系电话不能为空');
      } else {
        const phoneValidation = this.validatePhone(orderData.contactPhone);
        if (!phoneValidation.valid) {
          errors.push(phoneValidation.message);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * 验证商品信息
   */
  validateProductData(productData) {
    const errors = [];

    if (!productData.name || productData.name.trim() === '') {
      errors.push('商品名称不能为空');
    }

    if (!productData.price || productData.price <= 0) {
      errors.push('商品价格必须大于0');
    }

    if (!productData.categoryId) {
      errors.push('商品分类不能为空');
    }

    if (productData.stock !== undefined && productData.stock < 0) {
      errors.push('库存不能为负数');
    }

    if (!productData.description || productData.description.trim() === '') {
      errors.push('商品描述不能为空');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * 统一表单验证函数
   */
  validateForm(formData, rules) {
    const errors = {};

    for (const fieldName in rules) {
      const rule = rules[fieldName];
      const value = formData[fieldName];

      // 必填验证
      if (rule.required) {
        const result = this.validateRequired(value, rule.label || fieldName);
        if (!result.valid) {
          errors[fieldName] = result.message;
        }
      }

      // 类型验证
      if (rule.type && value !== undefined && value !== null && value !== '') {
        switch (rule.type) {
          case 'phone':
            const phoneResult = this.validatePhone(value);
            if (!phoneResult.valid) {
              errors[fieldName] = phoneResult.message;
            }
            break;
          case 'email':
            const emailResult = this.validateEmail(value);
            if (!emailResult.valid) {
              errors[fieldName] = emailResult.message;
            }
            break;
          case 'password':
            const passwordResult = this.validatePassword(value, rule.minLength, rule.maxLength);
            if (!passwordResult.valid) {
              errors[fieldName] = passwordResult.message;
            }
            break;
          case 'number':
            const numberResult = this.validateNumberRange(value, rule.min, rule.max, rule.label || fieldName);
            if (!numberResult.valid) {
              errors[fieldName] = numberResult.message;
            }
            break;
          case 'string':
            const stringResult = this.validateStringLength(value, rule.minLength, rule.maxLength, rule.label || fieldName);
            if (!stringResult.valid) {
              errors[fieldName] = stringResult.message;
            }
            break;
        }
      }

      // 自定义验证函数
      if (rule.validator && typeof rule.validator === 'function') {
        const customResult = rule.validator(value, formData);
        if (!customResult.valid) {
          errors[fieldName] = customResult.message;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
};