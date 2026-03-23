const priceToYuan = (price) => {
  return (parseFloat(price || 0) / 100).toFixed(2)
}

const stripCostFields = (product) => {
  if (!product || typeof product !== 'object') {
    return product
  }

  const { costPrice, originalPrice, ...rest } = product
  return rest
}

module.exports = {
  priceToYuan,
  stripCostFields
}
