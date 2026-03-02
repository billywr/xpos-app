package com.blinc.xpos.common.web.paging;

import java.util.Objects;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

@Component
public class PageRequestFactory {

  private final ApiPaginationProperties props;

  public PageRequestFactory(ApiPaginationProperties props) {
    this.props = Objects.requireNonNull(props, "props");
  }

  public Pageable normalize(Pageable pageable, Sort fallbackSort) {
    if (pageable == null) {
      return PageRequest.of(
          0, props.getDefaultSize(), fallbackSort == null ? Sort.unsorted() : fallbackSort);
    }

    int page = Math.max(0, pageable.getPageNumber());
    int size = pageable.getPageSize();
    if (size <= 0) {
      size = props.getDefaultSize();
    }
    size = Math.min(size, props.getMaxSize());

    Sort sort = pageable.getSort();
    if (sort == null || sort.isUnsorted()) {
      sort = fallbackSort == null ? Sort.unsorted() : fallbackSort;
    }
    return PageRequest.of(page, size, sort);
  }
}
